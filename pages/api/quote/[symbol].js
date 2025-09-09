// pages/api/quote/[symbol].js

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StockCompBot/1.0)" },
    // hint edge cache (Next/Vercel ignore si non supporté)
    next: { revalidate: 15 },
  });
  if (!r.ok) throw new Error("yahoo_http");
  const j = await r.json();
  const q = j?.quoteResponse?.result?.[0];
  if (!q) throw new Error("yahoo_empty");
  const price =
    (typeof q.regularMarketPrice === "number" && q.regularMarketPrice) ||
    (typeof q.postMarketPrice === "number" && q.postMarketPrice) ||
    (typeof q.preMarketPrice === "number" && q.preMarketPrice) ||
    (typeof q.ask === "number" && q.ask) ||
    (typeof q.bid === "number" && q.bid) ||
    (typeof q.previousClose === "number" && q.previousClose) ||
    null;
  if (!Number.isFinite(price) || price <= 0) throw new Error("yahoo_price");
  return {
    price: Number(price),
    currency: q.currency || "USD",
    name: q.shortName || q.longName || symbol,
    source: "yahoo",
  };
}

async function fetchStooq(symbol) {
  // Stooq attend du lower-case avec éventuellement un suffixe (.us, .pa, .de)
  const s = String(symbol).toLowerCase().trim();
  const candidates = [s];
  if (!s.includes(".")) candidates.push(`${s}.us`, `${s}.pa`, `${s}.de`);

  for (const c of candidates) {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(c)}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(url, { headers: { "User-Agent": "StockCompBot/1.0" } });
    if (!r.ok) continue;
    const csv = await r.text();
    // 2 lignes: header + data
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const headers = lines[0].split(",");
    const values = lines[1].split(",");
    if (!headers.length || !values.length) continue;
    const idxClose = headers.findIndex(h => /close/i.test(h));
    const idxName  = headers.findIndex(h => /name/i.test(h));
    const idxSym   = headers.findIndex(h => /^symbol$/i.test(h));
    if (idxClose === -1) continue;
    const close = Number(values[idxClose]);
    if (!Number.isFinite(close) || close <= 0) continue;

    return {
      price: close,
      currency: "USD", // Stooq ne renvoie pas la devise; défaut raisonnable
      name: (idxName !== -1 ? values[idxName] : null) || symbol.toUpperCase(),
      resolvedSymbol: idxSym !== -1 ? values[idxSym] : symbol.toUpperCase(),
      source: "stooq",
    };
  }
  throw new Error("stooq_fail");
}

export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: "symbol manquant" });
      return;
    }

    let out = null;
    // 1) Yahoo
    try { out = await fetchYahoo(symbol); } catch {}

    // 2) Stooq (si Yahoo KO)
    if (!out) {
      try { out = await fetchStooq(symbol); } catch {}
    }

    // 3) Dev fallback si tu as activé NEXT_PUBLIC_DEBUG=1
    if (!out && process.env.NEXT_PUBLIC_DEBUG === "1") {
      out = { price: 100, currency: "USD", name: symbol, source: "dev-fallback" };
    }

    if (!out) {
      res.status(502).json({ error: "quote indisponible (toutes sources)" });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    res.json({ symbol, ...out });
  } catch (e) {
    console.error("/api/quote error:", e);
    res.status(500).json({ error: "Erreur interne quote" });
  }
}