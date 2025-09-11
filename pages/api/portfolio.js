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
  return 1; // fallback neutre pour ne pas casser l'affichage
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

    // Récupère les quotes + devise
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        quotes[s] = q || null;
      } catch {
        quotes[s] = null;
      }
    }

    const enriched = [];
    for (const p of positions) {
      const q = quotes[p.symbol];
      const last =
        (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
        (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
        (typeof q?.preMarketPrice === "number" && q?.preMarketPrice) ??
        null;
      const ccy = q?.currency || "EUR";
      const rate = await fxToEUR(ccy);

      const mvEUR = Number.isFinite(last) ? last * Number(p.quantity || 0) * rate : 0;
      const pnlPct =
        (Number.isFinite(last) && Number(p.avgPrice) > 0)
          ? ((last - Number(p.avgPrice)) / Number(p.avgPrice)) * 100
          : 0;

      enriched.push({
        ...p,
        last,               // prix natif (USD, HKD, …)
        currency: ccy,      // devise native exposée à l’UI
        marketValue: mvEUR, // valorisation en EUR
        pnlPct
      });
    }

    const positionsValue = enriched.reduce((s, x) => s + (x.marketValue || 0), 0);
    const equity = Number(user.cash || 0) + positionsValue;

    return res.json({
      positions: enriched,
      cash: Number(user.cash || 0), // déjà en EUR
      positionsValue,
      equity
    });
  } catch (e) {
    console.error("[portfolio]", e);
    return res.status(500).json({ error: "Échec chargement portefeuille", detail: e.message });
  }
}