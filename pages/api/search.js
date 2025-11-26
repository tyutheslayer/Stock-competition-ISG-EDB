// pages/api/search.js
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 1) return res.status(400).send("Missing q");
  try {
    const results = await yahooFinance.search(q, { quotesCount: 10, newsCount: 0 });
    const items = (results.quotes || [])
      .filter(x => x.quoteType === "EQUITY" && x.symbol)
      .slice(0, 10)
      .map(x => ({
        symbol: x.symbol,
        shortname: x.shortname || x.longname || x.symbol,
        exchange: x.fullExchangeName || x.exchange || "",
        currency: x.currency || "",
      }));
    res.json(items);
  } catch (e) {
    res.status(500).send("Search failed");
  }
}
