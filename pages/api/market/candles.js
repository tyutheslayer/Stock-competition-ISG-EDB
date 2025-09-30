import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  try {
    const { symbol = "AAPL", range = "1mo", interval = "1d" } = req.query;
    const result = await yahooFinance.chart(symbol, { period1: "2020-01-01", range, interval });
    const candles = (result?.quotes || []).map(q => ({
      t: q.date, o: q.open, h: q.high, l: q.low, c: q.close, v: q.volume
    }));
    res.status(200).json({ symbol, range, interval, candles });
  } catch (e) {
    console.error("[api/market/candles]", e);
    res.status(500).json({ error: "FETCH_FAILED" });
  }
}