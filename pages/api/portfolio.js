// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { getQuoteMeta } from "../../lib/quoteCache";

export default async function handler(req, res) {
  try {
    // petit cache CDN (ISR/Edge) pour soulager l’API
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=40");

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

    // symboles uniques
    const symbols = [...new Set(positions.map(p => p.symbol))];

    // quotes Yahoo + meta (devise/FX via cache)
    const quotes = {};
    const metas  = {};
    for (const s of symbols) {
      try {
        metas[s]  = await getQuoteMeta(s); // { currency, rateToEUR } (mémoire 15s)
      } catch {
        metas[s]  = { currency: "EUR", rateToEUR: 1 };
      }
      try {
        quotes[s] = await yahooFinance.quote(s);
      } catch {
        quotes[s] = null;
      }
    }

    const pickNumber = (arr) => {
      for (const v of arr) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
      }
      return null;
    };

    const enriched = [];
    for (const p of positions) {
      const q   = quotes[p.symbol];
      const meta= metas[p.symbol] || { currency: "EUR", rateToEUR: 1 };

      // Dernier prix natif : on teste plusieurs champs (certains tickers n’ont pas regularMarketPrice)
      const lastNative = q
        ? pickNumber([
            q.regularMarketPrice,
            q.postMarketPrice,
            q.preMarketPrice,
            q.regularMarketPreviousClose,
            q.previousClose,
            q.price, // au cas où
          ])
        : null;

      const rate = Number(meta.rateToEUR || 1);
      const lastEUR = Number.isFinite(lastNative) ? Number(lastNative) * rate : null;

      // --- Heuristique robuste pour repositionner avgPrice en EUR si historique en devise native ---
      let avgPriceEUR = Number(p.avgPrice ?? 0);
      if (meta.currency !== "EUR" && Number.isFinite(lastNative) && Number.isFinite(lastEUR) && rate > 0) {
        const avg = avgPriceEUR;
        const distToNat = Math.abs(avg - Number(lastNative)) / (Math.abs(lastNative) || 1);
        const distToEUR = Math.abs(avg - Number(lastEUR))   / (Math.abs(lastEUR)   || 1);
        if (distToNat < distToEUR) {
          avgPriceEUR = avg * rate;
        }
        const ratio = Number(lastEUR) > 0 ? (avgPriceEUR / Number(lastEUR)) : 1;
        if (ratio < 0.1 || ratio > 10) {
          avgPriceEUR = avg * rate;
        }
      }

      const qty = Number(p.quantity || 0);
      const marketValue = (Number.isFinite(lastEUR) ? lastEUR : 0) * qty;

      const pnlPct = (avgPriceEUR > 0 && Number.isFinite(lastEUR))
        ? ((Number(lastEUR) - avgPriceEUR) / avgPriceEUR) * 100
        : 0;

      enriched.push({
        symbol: p.symbol,
        name: p.name,
        quantity: qty,
        currency: meta.currency,
        rateToEUR: rate,
        lastEUR: Number.isFinite(lastEUR) ? Number(lastEUR) : null,
        avgPriceEUR,
        pnlPct
      });
    }

    const positionsValue = enriched.reduce((s, r) => s + (r.lastEUR ? r.lastEUR * r.quantity : 0), 0);
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