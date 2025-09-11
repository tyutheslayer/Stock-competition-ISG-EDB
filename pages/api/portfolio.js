// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  return 1;
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, cash: true }
    });
    if (!user) return res.status(401).send("Non authentifié");

    const positions = await prisma.position.findMany({
      where: { userId: user.id },
      select: { symbol: true, name: true, quantity: true, avgPrice: true }
    });

    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = {};
    const fxRates = {};

    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const last =
          (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
          (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
          (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
          null;
        const ccy = q?.currency || "EUR";
        if (!(ccy in fxRates)) {
          fxRates[ccy] = await fxToEUR(ccy);
        }
        quotes[s] = { last, currency: ccy, rate: fxRates[ccy] };
      } catch {
        quotes[s] = { last: null, currency: "EUR", rate: 1 };
      }
    }

    const enriched = positions.map(p => {
      const q = quotes[p.symbol] || { last: null, currency: "EUR", rate: 1 };
      const lastEUR = Number.isFinite(q.last) ? q.last * q.rate : 0;
      const qty = Number(p.quantity || 0);
      const marketValue = lastEUR * qty;
      const pnl = (Number.isFinite(lastEUR) ? lastEUR : 0) - Number(p.avgPrice || 0); // (nb: avgPrice est natif; si tu veux aussi convertir historique, ajoute une colonne avgPriceEUR)
      const pnlPct = Number(p.avgPrice || 0) > 0 ? ((lastEUR - Number(p.avgPrice)) / Number(p.avgPrice)) * 100 : 0;

      return {
        symbol: p.symbol,
        name: p.name,
        quantity: qty,
        avgPrice: Number(p.avgPrice || 0), // note: c’est le prix moyen stocké (natif). Option: ajouter avgPriceEUR en DB plus tard.
        currency: q.currency,
        last: q.last,
        lastEUR,
        marketValue,
        pnl,
        pnlPct
      };
    });

    const positionsValue = enriched.reduce((s, p) => s + (p.marketValue || 0), 0);
    const equity = Number(user.cash || 0) + positionsValue;

    return res.json({
      positions: enriched,
      cash: Number(user.cash || 0),
      positionsValue,
      equity
    });
  } catch (e) {
    console.error("[portfolio]", e);
    return res.status(500).json({ error: "Échec chargement portefeuille", detail: e.message });
  }
}