// pages/api/search.js
import yahooFinance from "yahoo-finance2";

const TYPE_MAP = {
  EQUITY: "stock",
  ETF: "etf",
  INDEX: "index",
  MUTUALFUND: "fund",
  CURRENCY: "fx",
  CRYPTOCURRENCY: "crypto",
  FUTURE: "futures",
};

const ALLOWED_TYPES = Object.keys(TYPE_MAP); // ["EQUITY", "ETF", "INDEX", "MUTUALFUND", "CURRENCY", "CRYPTOCURRENCY", "FUTURE"]

export default async function handler(req, res) {
  const { q } = req.query;
  const query = String(q || "").trim();

  if (!query || query.length < 1) {
    return res.status(400).json({ error: "Missing q" });
  }

  try {
    const results = await yahooFinance.search(query, {
      quotesCount: 20,
      newsCount: 0,
    });

    const items = (results.quotes || [])
      .filter((x) => x && x.symbol)
      // on garde les principaux types (actions, ETF, indices, FX, crypto, futures…)
      .filter((x) => {
        if (!x.quoteType) return true; // si pas renseigné, on garde
        return ALLOWED_TYPES.includes(x.quoteType);
      })
      .slice(0, 20)
      .map((x) => ({
        symbol: x.symbol,
        shortname: x.shortname || x.longname || x.symbol,
        exchange: x.fullExchangeName || x.exchange || "",
        currency: x.currency || "",
        type: TYPE_MAP[x.quoteType] || "", // pour les badges dans l’UI
      }));

    return res.status(200).json(items);
  } catch (e) {
    console.error("[/api/search] error:", e);
    // on renvoie un tableau vide pour ne pas casser la search box
    return res.status(500).json([]);
  }
}