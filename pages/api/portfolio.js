// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import { getQuoteRaw, getFxToEUR } from "../../lib/quoteCache";

export default async function handler(req, res) {
  // Laisse le CDN mettre 15s en cache (SWR 45s)
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=45");

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
    for (const s of symbols) {
      try {
        quotes[s] = await getQuoteRaw(s);
      } catch {
        quotes[s] = null;
      }
    }

    const enriched = [];
    for (const p of positions) {
      const q = quotes[p.symbol] || {};
      const lastNative = Number.isFinite(q?.price) ? Number(q.price) : null;
      const ccy = q?.currency || "EUR";
      const rate = await getFxToEUR(ccy);
      const lastEUR = Number.isFinite(lastNative) ? lastNative * rate : null;

      // Heuristique pour remettre l’avg en EUR si ancien
      let avgPriceEUR = Number(p.avgPrice ?? 0);
      if (ccy !== "EUR" && Number.isFinite(lastNative) && Number.isFinite(lastEUR) && rate > 0) {
        const distToNat = Math.abs(avgPriceEUR - lastNative) / (Math.abs(lastNative) || 1);
        const distToEUR = Math.abs(avgPriceEUR - lastEUR)   / (Math.abs(lastEUR)   || 1);
        if (distToNat < distToEUR) avgPriceEUR = avgPriceEUR * rate;
        const ratio = Number(lastEUR) > 0 ? (avgPriceEUR / Number(lastEUR)) : 1;
        if (ratio < 0.1 || ratio > 10) avgPriceEUR = Number(p.avgPrice || 0) * rate;
      }

      const qty = Number(p.quantity || 0);
      const pnlPct = (avgPriceEUR > 0 && Number.isFinite(lastEUR))
        ? ((lastEUR - avgPriceEUR) / avgPriceEUR) * 100
        : 0;

      enriched.push({
        symbol: p.symbol,
        name: p.name,
        quantity: qty,
        currency: ccy,
        rateToEUR: rate,
        lastEUR: Number.isFinite(lastEUR) ? lastEUR : null,
        avgPriceEUR,
        pnlPct
      });
    }

    const positionsValue = enriched.reduce((s, x) => s + (x.lastEUR ? x.lastEUR * x.quantity : 0), 0);
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