// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  // Essai 1: CCY→EUR
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  // Essai 2: EUR→CCY (inversé)
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  // Fallback neutre
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

    // Quote chaque symbole, conserve devise et taux EUR
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const last =
          q?.regularMarketPrice ??
          q?.postMarketPrice ??
          q?.preMarketPrice ??
          null;
        const ccy = q?.currency || "EUR";
        const rateToEUR = await fxToEUR(ccy);
        quotes[s] = { last, currency: ccy, rateToEUR };
      } catch {
        quotes[s] = { last: null, currency: "EUR", rateToEUR: 1 };
      }
    }

    // Enrichit les positions avec lastEUR, marketValue (EUR), etc.
    const enriched = positions.map(p => {
      const q = quotes[p.symbol] || { last: null, currency: "EUR", rateToEUR: 1 };
      const lastNative = Number(q.last ?? NaN);
      const rate = Number(q.rateToEUR || 1);
      const lastEUR = Number.isFinite(lastNative) ? lastNative * rate : null;

      const qty = Number(p.quantity || 0);
      const avgEUR = Number(p.avgPrice || 0); // 🟩 après notre patch order.js, avgPrice est stocké en EUR
      const marketValue = Number.isFinite(lastEUR) ? lastEUR * qty : 0;
      const pnlPct =
        Number.isFinite(lastEUR) && avgEUR > 0
          ? ((lastEUR - avgEUR) / avgEUR) * 100
          : 0;

      return {
        symbol: p.symbol,
        name: p.name,
        quantity: qty,
        avgPrice: avgEUR,       // EUR
        lastEUR,                // EUR
        currency: q.currency,   // devise d’origine (info)
        rateToEUR: rate,        // taux utilisé (info)
        marketValue,            // EUR
        pnlPct
      };
    });

    const positionsValue = enriched.reduce((s, p) => s + (p.marketValue || 0), 0);
    const equity = Number(user.cash || 0) + positionsValue;

    return res.json({
      positions: enriched,
      cash: Number(user.cash || 0),   // EUR
      positionsValue,                 // EUR
      equity                          // EUR
    });
  } catch (e) {
    console.error("[portfolio]", e);
    return res.status(500).json({ error: "Échec chargement portefeuille", detail: e.message });
  }
}