// pages/api/search.js

// ⬅️ IMPORTANT : forcer le runtime Node.js (yahoo-finance2 ne supporte pas Edge)
export const config = { runtime: "nodejs" };

import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q || q.length < 1) {
    return res.status(400).json({ error: "MISSING_QUERY" });
  }

  try {
    const results = await yahooFinance.search(q, {
      quotesCount: 10,
      newsCount: 0,
    });

    const items = (results.quotes || [])
      .filter((x) => x.quoteType === "EQUITY" && x.symbol)
      .slice(0, 10)
      .map((x) => ({
        symbol: x.symbol,
        shortname: x.shortname || x.longname || x.symbol,
        exchange: x.fullExchangeName || x.exchange || "",
        currency: x.currency || "",
      }));

    return res.status(200).json(items);
  } catch (e) {
    console.error("[/api/search] error:", e);
    // En cas de fail API, on renvoie un tableau vide pour ne pas casser le front
    return res.status(200).json([]);
  }
}