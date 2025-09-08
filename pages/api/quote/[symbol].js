import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).send("Missing symbol");
  try {
    const q = await yahooFinance.quote(symbol);
    const price = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice;
    res.json({
      symbol,
      price,
      currency: q?.currency,
      exchange: q?.fullExchangeName || q?.exchange,
      time: q?.regularMarketTime || Date.now(),
      name: q?.shortName || q?.longName || symbol
    });
  } catch (e) {
    res.status(500).send("Quote failed");
  }
}
