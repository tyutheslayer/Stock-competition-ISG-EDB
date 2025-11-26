// pages/api/search.js

// (facultatif mais propre)
export const config = { runtime: "nodejs" };

// ❌ plus besoin de yahoo-finance2

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q || q.length < 1) {
    return res.status(400).json({ error: "MISSING_QUERY" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&quotesCount=10&newsCount=0`;

    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`Yahoo HTTP ${r.status}`);
    }

    const results = await r.json();

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
    // on renvoie un tableau vide pour ne pas casser l’UI
    return res.status(200).json([]);
  }
}