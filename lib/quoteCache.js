// lib/quoteCache.js
import yahooFinance from "yahoo-finance2";

/**
 * Mini LRU + TTL cache in-memory pour mutualiser les quotes
 * pendant la vie d’un process (ou cold start) et laisser Vercel
 * faire le edge cache via Cache-Control côté route.
 */

function createLRU(max = 500) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const v = map.get(key);
      // refresh recency
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key, val) {
      if (map.has(key)) map.delete(key);
      map.set(key, val);
      if (map.size > max) {
        // delete least-recent
        const first = map.keys().next().value;
        if (first !== undefined) map.delete(first);
      }
    }
  };
}

const QUOTE_TTL_MS = 15_000; // 15s
const FX_TTL_MS    = 60_000; // 60s

const lru = createLRU(800);

function now() { return Date.now(); }

function cacheGet(k) {
  const item = lru.get(k);
  if (!item) return undefined;
  if (item.exp <= now()) return undefined;
  return item.val;
}
function cacheSet(k, val, ttl) {
  lru.set(k, { exp: now() + ttl, val });
}

/** Quote d’un symbole (yahoo-finance2 raw) + currency + price (regular/post/pre) */
export async function getQuoteRaw(symbol) {
  const key = `q:${symbol}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const q = await yahooFinance.quote(symbol);
  const price =
    (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
    (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
    (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
    null;

  const out = {
    price,
    currency: q?.currency || "EUR",
    raw: q
  };
  cacheSet(key, out, QUOTE_TTL_MS);
  return out;
}

/** Taux FX -> EUR (nombre), avec fallback CCYEUR=X puis EURCCY=X (inverse) */
export async function getFxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  const key = `fx:${ccy}->EUR`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  // Essai direct CCYEUR=X
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 =
      q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) {
      cacheSet(key, r1, FX_TTL_MS);
      return r1;
    }
  } catch {}
  // Essai inverse EURCCY=X
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 =
      q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) {
      const v = 1 / r2;
      cacheSet(key, v, FX_TTL_MS);
      return v;
    }
  } catch {}

  cacheSet(key, 1, FX_TTL_MS);
  return 1;
}