// lib/quoteCache.js
import yahooFinance from "yahoo-finance2";

const qCache = new Map();  // key: `meta:${symbol}` -> { currency, rateToEUR }
const fxCache = new Map(); // key: currency -> rateToEUR
const TTL_MS = 15_000;

const now = () => Date.now();
const getCached = (map, key) => {
  const e = map.get(key);
  return e && e.expires > now() ? e.value : null;
};
const setCached = (map, key, value, ttl = TTL_MS) => {
  map.set(key, { value, expires: now() + ttl });
};

export async function getFxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;

  const cached = getCached(fxCache, ccy);
  if (cached != null) return cached;

  let rate = 1;
  try {
    const q = await yahooFinance.quote(`${ccy}EUR=X`);
    rate = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? 1;
    if (!(Number.isFinite(rate) && rate > 0)) throw new Error("bad");
  } catch {
    try {
      const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
      const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice ?? 0;
      rate = Number.isFinite(r2) && r2 > 0 ? 1 / r2 : 1;
    } catch {
      rate = 1;
    }
  }

  setCached(fxCache, ccy, rate);
  return rate;
}

export async function getQuoteMeta(symbol) {
  const k = `meta:${symbol}`;
  const cached = getCached(qCache, k);
  if (cached) return cached;

  let currency = "EUR";
  try {
    const q = await yahooFinance.quote(symbol);
    currency = q?.currency || "EUR";
  } catch {
    // Keep default EUR if Yahoo fails
  }

  const rateToEUR = await getFxToEUR(currency);
  const value = { currency, rateToEUR };
  setCached(qCache, k, value);
  return value;
}