// pages/api/quote/[symbol].js
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
  return 1;
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const q = await yahooFinance.quote(symbol);
    const price =
      q?.regularMarketPrice ??
      q?.postMarketPrice ??
      q?.preMarketPrice ??
      null;
    const currency = q?.currency || "EUR";
    const rateToEUR = await fxToEUR(currency);

    const priceEUR = Number.isFinite(price) ? price * rateToEUR : null;

    return res.json({
      symbol,
      name: q?.shortName || q?.longName || symbol,
      priceEUR,
      currency,
      rateToEUR,
    });
  } catch (e) {
    console.error("[quote]", e);
    return res.status(500).json({ error: "Quote failed" });
  }
}