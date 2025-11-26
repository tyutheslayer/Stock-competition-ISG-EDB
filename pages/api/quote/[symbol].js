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
    // 1️⃣ Récupération des métadonnées (devises, FX maison)
    const meta = await getQuoteMeta(symbol);

    // 2️⃣ TRY yahoo-finance2
    let q = null;
    try {
      q = await yahooFinance.quote(symbol);
    } catch (e) {
      console.warn("[quote] yahoo-finance2 failed → fallback:", e);
    }

    // 3️⃣ Fallback si yahoo-finance2 renvoie rien ou pas de prix
    if (!q || !q.regularMarketPrice) {
      q = await fetchYahooFallback(symbol);
    }

    if (!q) throw new Error("NO_QUOTE_DATA");

    // 4️⃣ Extraction du prix
    const price =
      q.regularMarketPrice ??
      q.postMarketPrice ??
      q.preMarketPrice ??
      q.previousClose ??
      null;

    if (price == null) {
      return res.status(200).json({
        symbol,
        name: q.shortName || q.longName || symbol,
        currency: meta.currency || q.currency || "EUR",
        priceEUR: null,
        rateToEUR: meta.rateToEUR,
      });
    }

    // 5️⃣ Conversion EUR via ton système interne
    const priceEUR = Number(price) * Number(meta.rateToEUR || 1);

    return res.status(200).json({
      symbol,
      name: q.shortName || q.longName || symbol,
      priceEUR,
      currency: meta.currency || q.currency || "EUR",
      rateToEUR: meta.rateToEUR,
      rawPrice: price,
    });
  } catch (e) {
    console.error("[/api/quote] FATAL:", e);
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