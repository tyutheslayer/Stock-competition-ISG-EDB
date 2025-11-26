// pages/api/search.js

export const config = { runtime: "nodejs" }; // comme avant

export default async function handler(req, res) {
  const { q } = req.query;
  const query = String(q || "").trim();

  if (!query || query.length < 1) {
    return res.status(400).json({ error: "MISSING_QUERY" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query
    )}&quotesCount=20&newsCount=0`;

    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`Yahoo HTTP ${r.status}`);
    }

    const results = await r.json();

    const allowedTypes = [
      "EQUITY",
      "ETF",
      "INDEX",
      "CRYPTOCURRENCY",
      // si tu veux plus tard : "CURRENCY", "FUTURE", etc.
    ];

    const items = (results.quotes || [])
      .filter((x) => x && x.symbol)
      .filter((x) => !x.quoteType || allowedTypes.includes(x.quoteType))
      .slice(0, 20)
      .map((x) => {
        let kind = "other";
        switch (x.quoteType) {
          case "EQUITY":
            kind = "stock";
            break;
          case "ETF":
            kind = "etf";
            break;
          case "INDEX":
            kind = "index";
            break;
          case "CRYPTOCURRENCY":
            kind = "crypto";
            break;
          default:
            kind = "other";
        }

        return {
          symbol: x.symbol,
          shortname: x.shortname || x.longname || x.symbol,
          exchange: x.fullExchangeName || x.exchange || "",
          currency: x.currency || "",
          kind, // ⬅️ pour les icônes / logos côté front
        };
      });

    return res.status(200).json(items);
  } catch (e) {
    console.error("[/api/search] error:", e);
    // comme ta version qui marchait : on renvoie un tableau vide pour ne pas casser l’UI
    return res.status(200).json([]);
  }
}