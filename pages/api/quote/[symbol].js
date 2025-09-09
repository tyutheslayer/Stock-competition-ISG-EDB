// pages/api/quote/[symbol].js

export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: "symbol manquant" });
      return;
    }

    // Source: Yahoo Finance public endpoint
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const y = await fetch(url, {
      // Un petit UA aide parfois côté edge
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StockCompBot/1.0)" },
      // Timeout soft via AbortSignal (facultatif)
      next: { revalidate: 15 }, // hint cache côté Vercel
    });

    if (!y.ok) {
      res.status(502).json({ error: "source quote indisponible" });
      return;
    }
    const j = await y.json();
    const r = j?.quoteResponse?.result?.[0];

    if (!r) {
      res.status(404).json({ error: "symbole introuvable" });
      return;
    }

    // Fallback chain pour avoir un prix même hors heures
    const price =
      (typeof r.regularMarketPrice === "number" ? r.regularMarketPrice : undefined) ??
      (typeof r.postMarketPrice === "number" ? r.postMarketPrice : undefined) ??
      (typeof r.preMarketPrice === "number" ? r.preMarketPrice : undefined) ??
      (typeof r.ask === "number" ? r.ask : undefined) ??
      (typeof r.bid === "number" ? r.bid : undefined) ??
      (typeof r.previousClose === "number" ? r.previousClose : undefined);

    if (!Number.isFinite(price) || price <= 0) {
      res.status(502).json({ error: "prix indisponible" });
      return;
    }

    // Cache côté edge (CDN) pour soulager l’API
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");

    res.json({
      symbol,
      price: Number(price),
      currency: r.currency || "USD",
      name: r.shortName || r.longName || symbol,
      ts: r.regularMarketTime || r.postMarketTime || r.preMarketTime || null,
      source: "yahoo+fallback",
    });
  } catch (e) {
    console.error("/api/quote error:", e);
    res.status(500).json({ error: "Erreur interne quote" });
  }
}