// lib/quoteCache.js
import yahooFinance from "yahoo-finance2";

const TTL_PRICE_MS = 10_000; // 10s pour les prix
const TTL_FX_MS = 60_000;    // 60s pour le FX

// Caches
const priceCache = new Map(); // symbol -> { value:{ price, currency }, exp:number }
const fxCache = new Map();    // ccy    -> { value:number,               exp:number }
const metaCache = new Map();  // symbol -> { value:{ currency, rateToEUR},exp:number }

const now = () => Date.now();
const getFresh = (map, key) => {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.exp > now()) return hit.value;
  map.delete(key);
  return null;
};
const setWithTtl = (map, key, value, ttl) =>
  map.set(key, { value, exp: now() + ttl });

/** ---- FX -> EUR (cache + fallback) ---- */
export async function getFxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;

  const cached = getFresh(fxCache, ccy);
  if (typeof cached === "number" && cached > 0) return cached;

  let rate = 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const p1 =
      Number(q1?.regularMarketPrice) ||
      Number(q1?.postMarketPrice) ||
      Number(q1?.preMarketPrice) ||
      0;
    if (p1 > 0) rate = p1;
    else throw new Error("bad direct");
  } catch {
    try {
      const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
      const p2 =
        Number(q2?.regularMarketPrice) ||
        Number(q2?.postMarketPrice) ||
        Number(q2?.preMarketPrice) ||
        0;
      rate = p2 > 0 ? 1 / p2 : 1;
    } catch {
      rate = 1;
    }
  }

  setWithTtl(fxCache, ccy, rate, TTL_FX_MS);
  return rate;
}

/** ---- Quote brut (prix natif + devise) avec cache + fallback ---- */
export async function getQuoteRaw(symbol) {
  const cached = getFresh(priceCache, symbol);
  if (cached && cached.price > 0 && cached.currency) return cached;

  let price = 0;
  let currency = "EUR";

  const fetchOnce = async () => {
    const q = await yahooFinance.quote(symbol);
    const p =
      Number(q?.regularMarketPrice) ||
      Number(q?.postMarketPrice) ||
      Number(q?.preMarketPrice) ||
      0;
    return { price: p, currency: q?.currency || "EUR" };
  };

  try {
    ({ price, currency } = await fetchOnce());
    if (!(price > 0)) {
      // second essai simple si le premier est nul
      ({ price, currency } = await fetchOnce());
    }
  } catch {
    // garde-fou
    price = 0;
    currency = "EUR";
  }

  const val = { price, currency };
  setWithTtl(priceCache, symbol, val, TTL_PRICE_MS);
  return val;
}

/** ---- Meta {currency, rateToEUR} (peut réutiliser getQuoteRaw) ---- */
export async function getQuoteMeta(symbol) {
  const cached = getFresh(metaCache, symbol);
  if (cached && cached.currency) return cached;

  const raw = await getQuoteRaw(symbol);
  const rateToEUR = await getFxToEUR(raw.currency || "EUR");
  const meta = { currency: raw.currency || "EUR", rateToEUR: Number(rateToEUR) || 1 };

  setWithTtl(metaCache, symbol, meta, TTL_PRICE_MS);
  return meta;
}

/** ---- Prix en EUR direct (cache de prix + FX) ---- */
export async function getQuotePriceEUR(symbol) {
  const raw = await getQuoteRaw(symbol);
  const rate = await getFxToEUR(raw.currency || "EUR");
  return (Number(raw.price) || 0) * (Number(rate) || 1);
}