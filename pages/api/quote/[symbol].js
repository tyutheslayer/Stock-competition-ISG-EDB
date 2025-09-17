// pages/api/quote/[symbol].js
import yahooFinance from "yahoo-finance2";
import { getQuoteMeta } from "../../../lib/quoteCache";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  // Autorise le cache CDN 10s (Vercel) + S-W-R
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=50");

  try {
    const meta = await getQuoteMeta(symbol);
    const q = await yahooFinance.quote(symbol);
    const price =
      q?.regularMarketPrice ??
      q?.postMarketPrice ??
      q?.preMarketPrice ??
      null;

    const priceEUR = Number.isFinite(price) ? Number(price) * meta.rateToEUR : null;

    return res.json({
      symbol,
      name: q?.shortName || q?.longName || symbol,
      priceEUR,
      currency: meta.currency,
      rateToEUR: meta.rateToEUR,
    });
  } catch (e) {
    console.error("[quote]", e);
    return res.status(500).json({ error: "Quote failed" });
  }
}