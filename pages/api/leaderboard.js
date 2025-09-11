// pages/api/leaderboard.js
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

// petit cache en RAM pour les taux sur 60s
const fxCache = new Map(); // key: "USD", value: { rate: number, t: number }
const FX_TTL_MS = 60_000;

async function fxToEUR(ccy) {
  const key = (ccy || "EUR").toUpperCase();
  if (key === "EUR") return 1;

  const now = Date.now();
  const hit = fxCache.get(key);
  if (hit && now - hit.t < FX_TTL_MS) return hit.rate;

  let rate = 1;
  try {
    const q1 = await yahooFinance.quote(`${key}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) {
      rate = r1;
    } else {
      const q2 = await yahooFinance.quote(`EUR${key}=X`);
      const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
      if (Number.isFinite(r2) && r2 > 0) rate = 1 / r2;
    }
  } catch (e) {
    logError?.("leaderboard_fx", e);
  }

  fxCache.set(key, { rate, t: now });
  return rate;
}

export default async function handler(req, res) {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const promo = (req.query.promo || "").trim();

  try {
    // 1) Filtre utilisateurs (par promo si demandé)
    const whereUser = {};
    if (promo) whereUser.promo = promo;

    const users = await prisma.user.findMany({
      where: whereUser,
      select: { id: true, email: true, name: true, cash: true, startingCash: true }
    });
    const userIds = users.map(u => u.id);

    // 2) Positions des users filtrés
    const allPositions = userIds.length
      ? await prisma.position.findMany({ where: { userId: { in: userIds } } })
      : [];

    // 3) Cotations des symboles utiles, converties en EUR
    const symbols = [...new Set(allPositions.map(p => p.symbol))];
    const prices = {}; // prix en EUR
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const px =
          q?.regularMarketPrice ??
          q?.postMarketPrice ??
          q?.preMarketPrice ??
          0;

        let rate = 1;
        const ccy = q?.currency || "EUR";
        if (ccy !== "EUR") {
          try {
            rate = await fxToEUR(ccy);
          } catch (e) {
            logError?.("leaderboard_fx_symbol", e);
            rate = 1;
          }
        }
        prices[s] = Number(px) * Number(rate); // 💶 stocké en EUR
      } catch (e) {
        logError?.("leaderboard_quote", e);
        prices[s] = 0; // on dégrade sans 500
      }
    }

    // 4) Equity (EUR) par user: cash (EUR) + Σ(qté * prix_EUR)
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash) || 0;
    for (const p of allPositions) {
      const lastEUR = Number(prices[p.symbol] || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + lastEUR * Number(p.quantity || 0);
    }

    // 5) Lignes + perf vs startingCash
    const rowsAll = users.map(u => {
      // ⚠️ Parenthèses indispensables autour de ?? quand combiné à ||
      const equity = (equityByUser[u.id] ?? Number(u.cash)) || 0;
      const start = Number(u.startingCash) || 0;
      const perf = start > 0 ? equity / start - 1 : 0;
      return {
        userId: u.id,
        name: u.name || null,
        email: u.email,
        equity, // en EUR
        perf
      };
    });

    // 6) Tri perf desc puis email pour stabilité
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