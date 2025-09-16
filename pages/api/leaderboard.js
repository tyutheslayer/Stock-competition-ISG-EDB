// pages/api/leaderboard.js
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const promo = (req.query.promo || "").trim();
  const period = String(req.query.period || "season").toLowerCase(); // day|week|month|season

  try {
    // 1) Filtre utilisateurs (ex: par promo)
    const whereUser = {};
    if (promo) whereUser.promo = promo;

    const users = await prisma.user.findMany({
      where: whereUser,
      select: { id: true, email: true, name: true, cash: true, startingCash: true }
    });
    const userIds = users.map(u => u.id);

    // 2) Positions des utilisateurs
    const allPositions = userIds.length
      ? await prisma.position.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, symbol: true, quantity: true }
        })
      : [];

    // --- bornes de période ---
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
    : null; // season → pas de t0

    // 3) FX helper
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

    // 4) Symboles (positions + éventuellement ordres période)
    let symbols = [...new Set(allPositions.map(p => p.symbol))];

    let ordersSinceT0 = [];
    if (t0 && userIds.length) {
      ordersSinceT0 = await prisma.order.findMany({
        where: { userId: { in: userIds }, createdAt: { gte: t0 } },
        select: { userId: true, symbol: true, side: true, quantity: true, price: true }
      });
      const extraSyms = [...new Set(ordersSinceT0.map(o => o.symbol))];
      symbols = [...new Set([...symbols, ...extraSyms])];
    }

    // 5) Prix actuels EUR
    const priceEurBySymbol = {};
    const ccyBySymbol = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const px =
          q?.regularMarketPrice ??
          q?.postMarketPrice ??
          q?.preMarketPrice ??
          null;
        const ccy = q?.currency || "EUR";
        const rate = await fxToEUR(ccy);
        ccyBySymbol[s] = ccy;
        priceEurBySymbol[s] = (Number.isFinite(px) ? Number(px) : 0) * rate;
      } catch (e) {
        logError?.("leaderboard_quote", e);
        priceEurBySymbol[s] = 0;
      }
    }

    // 6) Equity NOW (EUR)
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash || 0);

    for (const p of allPositions) {
      const lastEUR = Number(priceEurBySymbol[p.symbol] || 0);
      const qty = Number(p.quantity || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + lastEUR * qty;
    }

    // 7) Perf par période
    let perfByUser = {};
    if (!t0) {
      // Saison
      for (const u of users) {
        const equity = equityByUser[u.id] ?? 0;
        const start = Number(u.startingCash || 0);
        perfByUser[u.id] = start > 0 ? (equity / start - 1) : 0;
      }
    } else {
      // Jour/Semaine/Mois
      const deltaQtyByUserSym = new Map(); // `${userId}|${symbol}` -> number
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
      for (const s of symbols) {
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
          rate0 = await fxToEUR(ccyBySymbol[s] || "EUR");
        }
        if (!Number.isFinite(px0) || px0 <= 0) {
          px0 = (priceEurBySymbol[s] || 0) / (Number(rate0) || 1);
        }
        startPriceEurBySymbol[s] = Number(px0) * Number(rate0);
      }

      const qtyNowByUserSym = new Map();
      for (const p of allPositions) {
        qtyNowByUserSym.set(`${p.userId}|${p.symbol}`, Number(p.quantity || 0));
      }

      const equityStartByUser = {};
      for (const u of users) {
        const cashNow = Number(u.cash || 0);
        const cashChange = Number(netCashImpactByUser[u.id] || 0);
        const cashStart = cashNow - cashChange;

        let mvStart = 0;
        for (const s of symbols) {
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

      for (const u of users) {
        const now = equityByUser[u.id] ?? 0;
        const st = equityStartByUser[u.id] ?? 0;
        perfByUser[u.id] = st > 0 ? ((now - st) / st) : 0;
      }
    }

    // 8) Résultat
    const rowsAll = users.map(u => {
      const equity = (equityByUser[u.id] ?? 0);
      const perf = Number(perfByUser[u.id] ?? 0);
      return {
        userId: u.id,
        name: u.name || null,
        email: u.email,
        equity: Math.round(equity * 100) / 100,
        perf
      };
    });

    rowsAll.sort((a, b) => {
      if (b.perf !== a.perf) return b.perf - a.perf;
      return (a.email || "").localeCompare(b.email || "");
    });

    const total = rowsAll.length;
    const slice = rowsAll.slice(offset, offset + limit);
    const nextOffset = offset + slice.length < total ? offset + slice.length : null;

    return res.json({ rows: slice, total, nextOffset });
  } catch (e) {
    logError?.("leaderboard_fatal", e);
    return res.status(500).json({ error: "Échec leaderboard", detail: e?.message || String(e) });
  }
}