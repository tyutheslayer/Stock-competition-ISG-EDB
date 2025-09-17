// pages/api/quote/[symbol].js
import { getQuoteRaw, getFxToEUR } from "../../../lib/quoteCache";

export default async function handler(req, res) {
  // Edge cache (CDN) 10s + SWR 30s
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const { price, currency, raw } = await getQuoteRaw(symbol);
    const rateToEUR = await getFxToEUR(currency);
    const priceEUR = Number.isFinite(price) ? price * rateToEUR : null;

    return res.json({
      symbol,
      name: raw?.shortName || raw?.longName || symbol,
      priceEUR,
      currency,
      rateToEUR,
    });
  } catch (e) {
    console.error("[quote]", e);
    return res.status(500).json({ error: "Quote failed" });
  }
}