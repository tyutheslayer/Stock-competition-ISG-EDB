// pages/api/quote/[symbol].js
import yahooFinance from "yahoo-finance2";
import { getQuoteMeta } from "../../../lib/quoteCache";

export const config = { runtime: "nodejs" };

// 🌐 Fallback : Yahoo finance officiel (sans yahoo-finance2)
async function fetchYahooFallback(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error("Yahoo fallback failed " + r.status);

  const j = await r.json();
  return j?.quoteResponse?.result?.[0] || null;
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  // Cache CDN (Vercel)
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=50");

  try {
    // 1️⃣ Méta (devise + FX interne)
    const meta = await getQuoteMeta(symbol).catch(() => null);

    // 2️⃣ TRY yahoo-finance2
    let q = null;
    try {
      q = await yahooFinance.quote(symbol);
    } catch (e) {
      console.warn("[/api/quote] yahoo-finance2 failed → fallback:", e?.message || e);
    }

    // 3️⃣ Fallback si besoin
    if (!q || q.regularMarketPrice == null) {
      try {
        const fb = await fetchYahooFallback(symbol);
        if (fb) q = fb;
      } catch (e) {
        console.warn("[/api/quote] fallback failed:", e?.message || e);
      }
    }

    if (!q) {
      throw new Error("NO_QUOTE_DATA");
    }

    // 4️⃣ Prix brut
    const rawPrice =
      q.regularMarketPrice ??
      q.postMarketPrice ??
      q.preMarketPrice ??
      q.previousClose ??
      null;

    const priceNum = Number(rawPrice);
    const hasValidPrice = Number.isFinite(priceNum) && priceNum > 0;

    // 5️⃣ Taux FX → EUR sécurisé
    let rateToEUR = 1;
    if (meta && meta.rateToEUR != null) {
      const r = Number(meta.rateToEUR);
      if (Number.isFinite(r) && r > 0) {
        rateToEUR = r;
      }
    }

    // Si meta dit déjà EUR, on force 1
    const currency =
      meta?.currency || q.currency || "EUR";
    if (currency === "EUR") {
      rateToEUR = 1;
    }

    // 6️⃣ Prix en EUR (ou null si pas exploitable)
    const priceEUR = hasValidPrice ? priceNum * rateToEUR : null;

    return res.status(200).json({
      symbol,
      name: q.shortName || q.longName || symbol,
      priceEUR,
      currency,
      rateToEUR,
      rawPrice: hasValidPrice ? priceNum : null,
    });
  } catch (e) {
    console.error("[/api/quote] FATAL:", e?.message || e);
    // On renvoie un objet propre, mais SANS prix (⇒ le front affichera "…")
    return res.status(200).json({
      symbol,
      name: symbol,
      priceEUR: null,
      currency: "EUR",
      rateToEUR: 1,
      error: "QUOTE_FAILED",
    });
  }
}