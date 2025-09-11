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

    // --- Helpers FX ---
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
      return 1; // fallback neutre (évite de casser l'affichage)
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

      // Dernier natif + devise
      const lastNative =
        (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
        (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
        (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
        null;

      const ccy = q?.currency || "EUR";
      const rate = await fxToEUR(ccy);

      // Conversion du dernier en EUR
      const lastEUR = Number.isFinite(lastNative) ? Number(lastNative) * rate : null;

      // Heuristique pour avgPrice :
      // - Au nouvel ordre (patch), avgPrice est déjà en EUR
      // - Avant le patch, avgPrice est en devise native → on doit le convertir
      let avgPriceEUR = Number(p.avgPrice || 0);

      if (ccy !== "EUR") {
        // On devine si avgPrice ressemble à du natif plutôt qu'à de l'EUR.
        // Idée: si avg ≈ lastNative (même ordre de grandeur) ET s’éloigne fortement de lastEUR,
        // on considère qu’il est en natif et on le convertit.
        const lastEURnum = Number(lastEUR || 0);
        const lastNatNum = Number(lastNative || 0);

        // ratios robustes
        const ratioToEUR = lastEURnum > 0 ? Math.abs(avgPriceEUR - lastEURnum) / lastEURnum : 0;
        const ratioToNat = lastNatNum > 0 ? Math.abs(avgPriceEUR - lastNatNum) / lastNatNum : Infinity;

        // Si avg est "proche" du natif (≤ 25%) et "loin" de l'EUR (≥ 25%), on le convertit.
        if (ratioToNat <= 0.25 && ratioToEUR >= 0.25) {
          avgPriceEUR = avgPriceEUR * rate;
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