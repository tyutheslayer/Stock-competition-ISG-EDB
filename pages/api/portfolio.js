// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

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

    // --- Helpers FX vers EUR ---
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
      return 1; // fallback neutre
    }

    // Quote unique par symbole
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const quotes = {};
    for (const s of symbols) {
      try {
        quotes[s] = await yahooFinance.quote(s);
      } catch {
        quotes[s] = null;
      }
    }

    // Enrichissement + correction des anciens avg en devise
    const enriched = [];
    for (const p of positions) {
      const q = quotes[p.symbol];

      // Dernier prix "natif" (devise de la place) + devise
      const lastNative =
        (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
        (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
        (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
        null;

      const ccy = q?.currency || "EUR";
      const rate = await fxToEUR(ccy);

      // Conversion du dernier en EUR
      const lastEUR = Number.isFinite(lastNative) ? Number(lastNative) * rate : null;

      // --- Heuristique robuste pour avgPrice en EUR ---
      // - Si la position est récente (créée après le patch), avgPrice est déjà en EUR.
      // - Si elle est ancienne, avgPrice est probablement en devise native → on détecte et on convertit.
      let avgPriceEUR = Number(p.avgPrice ?? 0);

      if (ccy !== "EUR" && Number.isFinite(lastNative) && Number.isFinite(lastEUR) && rate > 0) {
        const avg = avgPriceEUR;

        // distances relatives (plus petit = plus proche)
        const distToNat = Math.abs(avg - Number(lastNative)) / (Math.abs(lastNative) || 1);
        const distToEUR = Math.abs(avg - Number(lastEUR))   / (Math.abs(lastEUR)   || 1);

        // Si l'avg est plus proche du prix natif que du prix EUR → c'était du natif
        if (distToNat < distToEUR) {
          avgPriceEUR = avg * rate;
        }

        // Garde-fou : si toujours très loin du dernier EUR (>10x ou <1/10x), force conversion
        const ratio = Number(lastEUR) > 0 ? (avgPriceEUR / Number(lastEUR)) : 1;
        if (ratio < 0.1 || ratio > 10) {
          avgPriceEUR = avg * rate;
        }
      }

      const qty = Number(p.quantity || 0);
      const marketValue = (Number.isFinite(lastEUR) ? lastEUR : 0) * qty;

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

    const positionsValue = enriched.reduce((s, p) => s + (p.lastEUR ? p.lastEUR * p.quantity : 0), 0);
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