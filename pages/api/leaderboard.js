// pages/api/leaderboard.js
import prisma from "../../lib/prisma";
import { getQuoteRaw, getFxToEUR } from "../../lib/quoteCache";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  // Edge/CDN cache léger
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");

  const limit  = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const promo  = (req.query.promo || "").trim();
  const period = String(req.query.period || "season").toLowerCase(); // day|week|month|season

  try {
    // --- Users (filtre promo) ---
    const whereUser = {};
    if (promo) whereUser.promo = promo;

    const users = await prisma.user.findMany({
      where: whereUser,
      select: { id: true, email: true, name: true, cash: true, startingCash: true },
    });
    const userIds = users.map(u => u.id);

    // --- Positions ---
    const allPositions = userIds.length
      ? await prisma.position.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, symbol: true, quantity: true },
        })
      : [];

    // --- Bornes période ---
    function startOfTodayUTC() {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0,0,0,0));
    }
    function startOfISOWeekUTC() {
      const d = new Date();
      const day = (d.getUTCDay() + 6) % 7; // lundi=0
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0,0,0,0));
      start.setUTCDate(start.getUTCDate() - day);
      return start;
    }
    function startOfMonthUTC() {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0,0,0,0));
    }
    const t0 =
      period === "day"   ? startOfTodayUTC()
    : period === "week"  ? startOfISOWeekUTC()
    : period === "month" ? startOfMonthUTC()
    : null;

    // --- Symboles à coter ---
    let symbols = [...new Set(allPositions.map(p => p.symbol))];

    let ordersSinceT0 = [];
    if (t0 && userIds.length) {
      ordersSinceT0 = await prisma.order.findMany({
        where: { userId: { in: userIds }, createdAt: { gte: t0 } },
        select: { userId: true, symbol: true, side: true, quantity: true, price: true },
      });
      const extra = [...new Set(ordersSinceT0.map(o => o.symbol))];
      symbols = [...new Set([...symbols, ...extra])];
    }

    // --- Parallélise quotes & FX courants (via cache) ---
    const priceEurBySymbol = {};
    const ccyBySymbol = {};

    // mémo FX pour éviter les appels redondants
    const fxMemo = new Map(); // ccy -> rate
    async function fxEUR(ccy) {
      const k = ccy || "EUR";
      if (fxMemo.has(k)) return fxMemo.get(k);
      const r = await getFxToEUR(k);
      const v = Number.isFinite(r) && r > 0 ? Number(r) : 1;
      fxMemo.set(k, v);
      return v;
    }

    await Promise.all(symbols.map(async (s) => {
      try {
        const q   = await getQuoteRaw(s);          // attendu: { price, currency }
        const ccy = q?.currency || "EUR";
        const px  = Number(q?.price);
        const rate = await fxEUR(ccy);
        ccyBySymbol[s] = ccy;
        priceEurBySymbol[s] = (Number.isFinite(px) ? px : 0) * rate;
      } catch (e) {
        logError?.("leaderboard_quote", e);
        ccyBySymbol[s] = "EUR";
        priceEurBySymbol[s] = 0;
      }
    }));

    // --- Equity NOW = cash + MV positions en EUR ---
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash || 0);

    for (const p of allPositions) {
      const lastEUR = Number(priceEurBySymbol[p.symbol] || 0);
      const qty     = Number(p.quantity || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + lastEUR * qty;
    }

    // --- Perf par période ---
    let perfByUser = {};
    if (!t0) {
      // Saison -> base = startingCash
      for (const u of users) {
        const eq = equityByUser[u.id] ?? 0;
        const st = Number(u.startingCash || 0);
        perfByUser[u.id] = st > 0 ? (eq / st - 1) : 0;
      }
    } else {
      // Périodes glissantes
      const deltaQtyByUserSym = new Map();  // `${userId}|${symbol}` -> Δqty depuis t0
      const netCashImpactByUser = {};       // impact cash depuis t0 (EUR)
      let feeBps = 0;
      try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { tradingFeeBps: true } });
        feeBps = Number(settings?.tradingFeeBps || 0);
      } catch {}

      // calcule impact cash & delta qty avec FX mémo
      for (const o of ordersSinceT0) {
        const qty = Number(o.quantity || 0);
        const pxNative = Number(o.price || 0);
        const ccy = ccyBySymbol[o.symbol] || "EUR";
        const rate = await fxEUR(ccy);
        const pxEUR = pxNative * rate;
        const feeEUR = (pxEUR * qty) * (feeBps / 10000);
        const gross  = pxEUR * qty;
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

      // prix de départ (EUR) par symbole
      const startPriceEurBySymbol = {};
      await Promise.all(symbols.map(async (s) => {
        const ccy   = ccyBySymbol[s] || "EUR";
        let px0Nat  = await histClose(s, t0);             // prix natif au début
        let rate0   = await fxEUR(ccy);
        if (!Number.isFinite(px0Nat) || px0Nat <= 0) {
          // fallback: transforme prix actuel EUR en natif approximatif pour éviter 0
          const currentEUR = Number(priceEurBySymbol[s] || 0);
          px0Nat = rate0 > 0 ? currentEUR / rate0 : null;
        }
        if (!Number.isFinite(rate0) || rate0 <= 0) rate0 = 1;
        startPriceEurBySymbol[s] = Number(px0Nat) * Number(rate0);
      }));

      // qty au début + equityStart
      const qtyNowByUserSym = new Map();
      for (const p of allPositions) {
        qtyNowByUserSym.set(`${p.userId}|${p.symbol}`, Number(p.quantity || 0));
      }

      const equityStartByUser = {};
      for (const u of users) {
        const cashNow   = Number(u.cash || 0);
        const cashDelta = Number(netCashImpactByUser[u.id] || 0);
        const cashStart = cashNow - cashDelta;

        let mvStart = 0;
        for (const s of symbols) {
          const qNow  = qtyNowByUserSym.get(`${u.id}|${s}`) || 0;
          const dQty  = deltaQtyByUserSym.get(`${u.id}|${s}`) || 0;
          const qStart= qNow - dQty;
          if (qStart !== 0) {
            const p0 = Number(startPriceEurBySymbol[s] || 0);
            mvStart += qStart * p0;
          }
        }
        equityStartByUser[u.id] = cashStart + mvStart;
      }

      for (const u of users) {
        const nowEq = equityByUser[u.id] ?? 0;
        const stEq  = equityStartByUser[u.id] ?? 0;
        perfByUser[u.id] = stEq > 0 ? ((nowEq - stEq) / stEq) : 0;
      }
    }

    // --- Résultat paginé ---
    const rowsAll = users.map(u => {
      const equity = Math.round((equityByUser[u.id] ?? 0) * 100) / 100;
      const perf   = Number(perfByUser[u.id] ?? 0);
      return {
        userId: u.id,
        name: u.name || null,
        email: u.email,
        equity,
        perf,
      };
    });

    rowsAll.sort((a, b) => (b.perf !== a.perf ? b.perf - a.perf : (a.email || "").localeCompare(b.email || "")));

    const total = rowsAll.length;
    const slice = rowsAll.slice(offset, offset + limit);
    const nextOffset = offset + slice.length < total ? offset + slice.length : null;

    return res.json({ rows: slice, total, nextOffset });
  } catch (e) {
    logError?.("leaderboard_fatal", e);
    return res.status(500).json({ error: "Échec leaderboard", detail: e?.message || String(e) });
  }
}