// pages/api/quote/[symbol].js
export default async function handler(req, res) {
  const symbol = String(req.query.symbol || "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "Symbole manquant" });

  // Helper: Yahoo
  async function fromYahoo(sym) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (StockCompBot/1.0)" } });
    if (!r.ok) throw new Error("yahoo_http");
    const j = await r.json();
    const q = j?.quoteResponse?.result?.[0];
    if (!q) throw new Error("yahoo_empty");
    const price =
      (typeof q.regularMarketPrice === "number" && q.regularMarketPrice) ??
      (typeof q.postMarketPrice === "number" && q.postMarketPrice) ??
      (typeof q.preMarketPrice === "number" && q.preMarketPrice) ??
      (typeof q.ask === "number" && q.ask) ??
      (typeof q.bid === "number" && q.bid) ??
      (typeof q.previousClose === "number" && q.previousClose) ?? null;
    if (!Number.isFinite(price) || price <= 0) throw new Error("yahoo_price");
    return { price: Number(price), currency: q.currency || "USD", name: q.shortName || q.longName || symbol };
  }

  // Helper: Stooq (close)
  async function fromStooq(sym) {
    const s = String(sym).toLowerCase().trim();
    const candidates = [s];
    if (!s.includes(".")) candidates.push(`${s}.us`, `${s}.pa`, `${s}.de`);
    for (const c of candidates) {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(c)}&f=sd2t2ohlcv&h&e=csv`;
      const r = await fetch(url, { headers: { "User-Agent": "StockCompBot/1.0" } });
      if (!r.ok) continue;
      const csv = await r.text();
      const lines = csv.trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      const headers = lines[0].split(",");
      const values  = lines[1].split(",");
      const iClose = headers.findIndex(h => /close/i.test(h));
      if (iClose === -1) continue;
      const close = Number(values[iClose]);
      if (!Number.isFinite(close) || close <= 0) continue;
      return { price: close, currency: "USD", name: sym };
    }
    throw new Error("stooq_fail");
  }

  try {
    try {
      const out = await fromYahoo(symbol);
      return res.json(out);
    } catch {}
    const out = await fromStooq(symbol);
    return res.json(out);
  } catch (e) {
    // IMPORTANT : plus de fallback 100, on renvoie une erreur claire
    console.error("/api/quote error:", e);
    return res.status(502).json({ error: "Prix indisponible (sources épuisées)" });
  }
}