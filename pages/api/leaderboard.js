// pages/api/leaderboard.js
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const promo = (req.query.promo || "").trim();

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

    // 3) Quotes → EUR (même logique que /api/portfolio)
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

    const symbols = [...new Set(allPositions.map(p => p.symbol))];
    const priceEurBySymbol = {};

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
        priceEurBySymbol[s] = (Number.isFinite(px) ? Number(px) : 0) * rate; // store in EUR
      } catch (e) {
        logError?.("leaderboard_quote", e);
        priceEurBySymbol[s] = 0;
      }
    }

    // 4) Equity (EUR) par utilisateur
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash || 0);

    for (const p of allPositions) {
      const lastEUR = Number(priceEurBySymbol[p.symbol] || 0);
      const qty = Number(p.quantity || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + lastEUR * qty;
    }

    // 5) Lignes + perf vs startingCash
    const rowsAll = users.map(u => {
      const equity = (equityByUser[u.id] ?? 0);
      const start = Number(u.startingCash || 0);
      const perf = start > 0 ? equity / start - 1 : 0;
      return {
        userId: u.id,
        name: u.name || null,
        email: u.email,
        equity: Math.round(equity * 100) / 100, // 2 décimales
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