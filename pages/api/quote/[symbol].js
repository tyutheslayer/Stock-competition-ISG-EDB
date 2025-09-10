import yahooFinance from "yahoo-finance2";
import { logError } from "../../../lib/logger";

export default async function handler(req, res) {
  const { symbol } = req.query || {};
  if (!symbol) return res.status(400).json({ error: "Symbol requis" });

  try {
    // 1) essai quote live
    const q = await yahooFinance.quote(symbol);
    const price =
      (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ||
      (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ||
      (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ||
      null;

    const prev =
      (typeof q?.regularMarketPreviousClose === "number" && q.regularMarketPreviousClose) ||
      (typeof q?.previousClose === "number" && q.previousClose) ||
      null;

    let change = null, changePct = null;
    if (price != null && prev != null && prev > 0) {
      change = price - prev;
      changePct = (change / prev) * 100;
    }

    if (price != null) {
      return res.json({
        symbol,
        name: q?.shortName || q?.longName || symbol,
        price,
        currency: q?.currency || null,
        change,
        changePct
      });
    }

    // 2) fallback CSV (EOD) – même logique de calcul
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
    const rr = await fetch(url);
    if (!rr.ok) throw new Error(`stooq fail ${rr.status}`);
    const text = await rr.text();
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",");
    const idxClose = headers.findIndex(h => /close/i.test(h));
    if (idxClose !== -1 && lines.length >= 2) {
      const prevLine = lines[lines.length - 2]?.split(",");
      const lastLine = lines[lines.length - 1]?.split(",");
      const prevClose = Number(prevLine?.[idxClose]);
      const close = Number(lastLine?.[idxClose]);
      if (Number.isFinite(close) && close > 0) {
        let ch = null, chPct = null;
        if (Number.isFinite(prevClose) && prevClose > 0) {
          ch = close - prevClose;
          chPct = (ch / prevClose) * 100;
        }
        return res.json({
          symbol,
          name: symbol,
          price: close,
          currency: null,
          change: ch,
          changePct: chPct
        });
      }
    }

    return res.status(400).json({ error: "source quote indisponible" });
  } catch (e) {
    try { logError?.("quote", e); } catch {}
    return res.status(500).json({ error: "Échec quote", detail: e?.message || String(e) });
  }
}
