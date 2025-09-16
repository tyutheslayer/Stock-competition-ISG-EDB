// lib/badges.js
import prisma from "../lib/prisma";
import yahooFinance from "yahoo-finance2";

/** -------- Helpers période (UTC) -------- */
function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function startOfISOWeekUTC() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // lundi=0
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - day);
  return start;
}
function startOfMonthUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
export function periodStart(period) {
  switch (period) {
    case "day": return startOfTodayUTC();
    case "week": return startOfISOWeekUTC();
    case "month": return startOfMonthUTC();
    default: return null; // season
  }
}

/** FX helper : ccy -> EUR */
async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  return 1;
}

/** Récupère (users, positions, ordersSinceT0) + prix EUR par symbole */
export async function loadBaseData({ promo, period }) {
  const whereUser = {};
  if (promo) whereUser.promo = promo;

  const users = await prisma.user.findMany({
    where: whereUser,
    select: { id: true, email: true, name: true, cash: true, startingCash: true }
  });
  const userIds = users.map(u => u.id);

  const positions = userIds.length
    ? await prisma.position.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, symbol: true, quantity: true }
      })
    : [];

  const t0 = periodStart(period);
  let ordersSinceT0 = [];
  if (t0 && userIds.length) {
    ordersSinceT0 = await prisma.order.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: t0 } },
      select: { userId: true, symbol: true, side: true, quantity: true, price: true }
    });
  }

  // Symboles à coter
  let symbols = [...new Set(positions.map(p => p.symbol))];
  if (ordersSinceT0.length) {
    const extra = [...new Set(ordersSinceT0.map(o => o.symbol))];
    symbols = [...new Set([...symbols, ...extra])];
  }

  // Prix actuels EUR
  const priceEurBySymbol = {};
  const ccyBySymbol = {};
  for (const s of symbols) {
    try {
      const q = await yahooFinance.quote(s);
      const px = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? null;
      const ccy = q?.currency || "EUR";
      const rate = await fxToEUR(ccy);
      ccyBySymbol[s] = ccy;
      priceEurBySymbol[s] = (Number.isFinite(px) ? Number(px) : 0) * rate;
    } catch {
      priceEurBySymbol[s] = 0;
    }
  }

  return { users, positions, ordersSinceT0, priceEurBySymbol, ccyBySymbol, t0 };
}

/** Calcule equity NOW et perf(period) ~ logique proche de /api/leaderboard */
export async function computePerfByUser({ users, positions, ordersSinceT0, priceEurBySymbol, ccyBySymbol, t0 }) {
  // Equity NOW
  const equityNowByUser = {};
  for (const u of users) equityNowByUser[u.id] = Number(u.cash || 0);
  for (const p of positions) {
    const lastEUR = Number(priceEurBySymbol[p.symbol] || 0);
    const qty = Number(p.quantity || 0);
    equityNowByUser[p.userId] = (equityNowByUser[p.userId] || 0) + lastEUR * qty;
  }

  // Saison → perf vs startingCash
  if (!t0) {
    const perf = {};
    for (const u of users) {
      const now = equityNowByUser[u.id] ?? 0;
      const start = Number(u.startingCash || 0);
      perf[u.id] = start > 0 ? (now / start - 1) : 0;
    }
    return { equityNowByUser, equityStartByUser: null, perfByUser: perf };
  }

  // Période → reconstituer equity de départ (cashStart + positionsStart)
  const deltaQtyByUserSym = new Map(); // key `${userId}|${symbol}`
  const netCashImpactByUser = {}; // EUR
  let feeBps = 0;
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { tradingFeeBps: true } });
    feeBps = Number(settings?.tradingFeeBps || 0);
  } catch {}

  for (const o of ordersSinceT0) {
    const qty = Number(o.quantity || 0);
    const pxNative = Number(o.price || 0);
    const ccy = ccyBySymbol[o.symbol] || "EUR";
    const rate = await fxToEUR(ccy);
    const pxEUR = pxNative * rate;
    const feeEUR = (pxEUR * qty) * (feeBps / 10000);
    const gross = pxEUR * qty;
    const totalEUR = o.side === "BUY" ? (gross + feeEUR) : (gross - feeEUR);

    const key = `${o.userId}|${o.symbol}`;
    deltaQtyByUserSym.set(key, (deltaQtyByUserSym.get(key) || 0) + (o.side === "BUY" ? qty : -qty));
    netCashImpactByUser[o.userId] = (netCashImpactByUser[o.userId] || 0) + (o.side === "BUY" ? -totalEUR : +totalEUR);
  }

  async function histClose(symbol, fromDate) {
    try {
      const bars = await yahooFinance.historical(symbol, { period1: fromDate, period2: new Date(), interval: "1d" });
      if (Array.isArray(bars) && bars.length > 0) {
        const first = bars[0];
        return Number(first?.close ?? first?.adjClose ?? NaN);
      }
    } catch {}
    return null;
  }

  const startPriceEurBySymbol = {};
  for (const s of Object.keys(priceEurBySymbol)) {
    const ccy = ccyBySymbol[s] || "EUR";
    let px0 = await histClose(s, t0);
    if (!Number.isFinite(px0) || px0 <= 0) px0 = null;
    let rate0 = 1;
    if (ccy !== "EUR") {
      let fxSym = `${ccy}EUR=X`;
      let fx0 = await histClose(fxSym, t0);
      if (!Number.isFinite(fx0) || fx0 <= 0) {
        fxSym = `EUR${ccy}=X`;
        fx0 = await histClose(fxSym, t0);
        rate0 = Number.isFinite(fx0) && fx0 > 0 ? (1 / fx0) : null;
      } else {
        rate0 = fx0;
      }
    }
    if (!Number.isFinite(rate0) || rate0 <= 0) {
      rate0 = await fxToEUR(ccy);
    }
    if (!Number.isFinite(px0) || px0 <= 0) {
      px0 = (priceEurBySymbol[s] || 0) / (Number(rate0) || 1);
    }
    startPriceEurBySymbol[s] = Number(px0) * Number(rate0);
  }

  const qtyNowByUserSym = new Map();
  for (const p of positions) {
    qtyNowByUserSym.set(`${p.userId}|${p.symbol}`, Number(p.quantity || 0));
  }

  const equityStartByUser = {};
  for (const u of users) {
    const cashNow = Number(u.cash || 0);
    const cashChange = Number(netCashImpactByUser[u.id] || 0);
    const cashStart = cashNow - cashChange;

    let mvStart = 0;
    for (const s of Object.keys(startPriceEurBySymbol)) {
      const qNow = qtyNowByUserSym.get(`${u.id}|${s}`) || 0;
      const dQty = deltaQtyByUserSym.get(`${u.id}|${s}`) || 0;
      const qStart = qNow - dQty;
      if (qStart !== 0) {
        const p0 = Number(startPriceEurBySymbol[s] || 0);
        mvStart += qStart * p0;
      }
    }
    equityStartByUser[u.id] = cashStart + mvStart;
  }

  const perfByUser = {};
  for (const u of users) {
    const now = equityNowByUser[u.id] ?? 0;
    const st = equityStartByUser[u.id] ?? 0;
    perfByUser[u.id] = st > 0 ? ((now - st) / st) : 0;
  }

  return { equityNowByUser, equityStartByUser, perfByUser };
}

/** Règles de badges (purement dérivées, pas de DB writes) */
export function deriveBadges({ users, perfByUser, ordersSinceT0, ranksByUser, period }) {
  const badgesByUser = {};
  const ordersCountByUser = {};
  for (const o of ordersSinceT0 || []) {
    ordersCountByUser[o.userId] = (ordersCountByUser[o.userId] || 0) + 1;
  }

  for (const u of users) {
    const list = [];

    // TOP 10 (selon la perf de la période)
    if (ranksByUser[u.id] != null && ranksByUser[u.id] <= 10) {
      list.push({ id: "top10", label: "Top 10", emoji: "🏅" });
    }

    // BIG GAINER (+5% ou plus sur la période)
    const pf = Number(perfByUser[u.id] ?? 0);
    if (pf >= 0.05) list.push({ id: "big_gainer", label: "+5% période", emoji: "🚀" });

    // ACTIVE TRADER (≥ 5 ordres sur la période)
    if ((ordersCountByUser[u.id] || 0) >= 5) list.push({ id: "active_trader", label: "Trader actif", emoji: "⚡️" });

    // COMEBACK (négatif → positif sur la période) — uniquement si période ≠ season
    if (period !== "season") {
      // Heuristique: perf période > 0 ET au moins 3 ordres
      if (pf > 0 && (ordersCountByUser[u.id] || 0) >= 3) {
        list.push({ id: "comeback", label: "Comeback", emoji: "🧩" });
      }
    }

    badgesByUser[u.id] = list;
  }

  return badgesByUser;
}

/** Calcul complet pour un ensemble d'utilisateurs; renvoie { rows, ranks } */
export async function computeBadgesBundle({ promo, period }) {
  const { users, positions, ordersSinceT0, priceEurBySymbol, ccyBySymbol, t0 } =
    await loadBaseData({ promo, period });

  const { equityNowByUser, perfByUser } =
    await computePerfByUser({ users, positions, ordersSinceT0, priceEurBySymbol, ccyBySymbol, t0 });

  // Classement perf desc
  const sorted = [...users].sort((a, b) => (perfByUser[b.id] ?? 0) - (perfByUser[a.id] ?? 0));
  const ranksByUser = {};
  sorted.forEach((u, idx) => { ranksByUser[u.id] = idx + 1; });

  const badgesByUser = deriveBadges({ users, perfByUser, ordersSinceT0, ranksByUser, period });

  const rows = users.map(u => ({
    userId: u.id,
    email: u.email,
    name: u.name,
    equity: Math.round((equityNowByUser[u.id] ?? 0) * 100) / 100,
    perf: Number(perfByUser[u.id] ?? 0),
    rank: ranksByUser[u.id] ?? null,
    badges: badgesByUser[u.id] ?? []
  }));

  return { rows, ranksByUser };
}