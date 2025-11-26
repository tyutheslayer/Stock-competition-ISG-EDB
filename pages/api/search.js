// pages/api/search.js

export default async function handler(req, res) {
  const { q } = req.query;
  const query = String(q || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing q" });
  }

  try {
    const url = `https://symbol-search.tradingview.com/symbol_search/?text=${encodeURIComponent(
      query
    )}&lang=en&domain=production`;

    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`Remote search failed (${r.status})`);
    }

    const raw = await r.json();

    // TradingView renvoie soit un array direct, soit { symbols: [...] } ou { result: [...] }
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.symbols)
      ? raw.symbols
      : Array.isArray(raw?.result)
      ? raw.result
      : [];

    const allowedTypes = [
      "stock",
      "crypto",
      "index",
      "fund",
      "etf",
      "futures",
      "forex",
      "currency",
    ];

    const items = arr
      .filter((x) => x && x.symbol)
      .filter((x) => {
        const t = String(x.type || "").toLowerCase();
        if (!t) return true; // on garde si pas de type, pour ne pas filtrer trop
        return allowedTypes.includes(t);
      })
      .slice(0, 15)
      .map((x) => ({
        symbol: x.symbol,
        shortname: x.description || x.full_name || x.symbol,
        exchange: x.exchange || "",
        currency: x.currency || "",
        type: x.type || "",
      }));

    return res.status(200).json(items);
  } catch (e) {
    console.error("[/api/search] error:", e);
    // On renvoie un tableau vide pour ne pas crasher l'UI
    return res.status(500).json([]);
  }
}