// pages/api/search.js
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const q = String(req.query.q || "").trim();

    // Moins de 2 caractères → pas de recherche
    if (!q || q.length < 2) {
      return res.status(200).json([]);
    }

    // On interroge l'API de Yahoo Finance
    const result = await yahooFinance.search(q, {
      quotesCount: 10,
      newsCount: 0,
    });

    const quotes = Array.isArray(result?.quotes) ? result.quotes : [];

    // On normalise au format attendu par <SearchBox />
    const out = quotes
      .filter((it) => !!it.symbol)
      .map((it) => ({
        symbol: it.symbol,
        shortname: it.shortname || it.longname || "",
        exchange: it.exchange || it.fullExchangeName || "",
        currency: it.currency || "",
      }));

    return res.status(200).json(out);
  } catch (e) {
    console.error("[/api/search] error:", e);
    // En cas de souci, on renvoie un tableau vide (pour ne pas casser le front)
    return res.status(200).json([]);
  }
}