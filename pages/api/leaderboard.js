// pages/api/leaderboard.js
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const school = (req.query.school || "").trim();
  const promo = (req.query.promo || "").trim();

  try {
    // 1) filtre users
    const whereUser = {};
    if (school) whereUser.school = school;
    if (promo) whereUser.promo = promo;

    const users = await prisma.user.findMany({
      where: whereUser,
      select: { id: true, email: true, name: true, cash: true, startingCash: true }
    });
    const userIds = users.map(u => u.id);

    // 2) positions des users filtrés
    const allPositions = userIds.length
      ? await prisma.position.findMany({ where: { userId: { in: userIds } } })
      : [];

    // 3) preços : on quote seulement les symbols utiles
    const symbols = [...new Set(allPositions.map(p => p.symbol))];
    const prices = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        prices[s] =
          q?.regularMarketPrice ??
          q?.postMarketPrice ??
          q?.preMarketPrice ??
          0;
      } catch (e) {
        logError?.("leaderboard", e);
        prices[s] = 0; // pas de 500, on degrade simplement
      }
    }

    // 4) calc equity par user
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash);
    for (const p of allPositions) {
      const last = Number(prices[p.symbol] || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + last * Number(p.quantity);
    }

    const rowsAll = users.map(u => {
      const equity = equityByUser[u.id] ?? Number(u.cash);
      const start = Number(u.startingCash) || 0;
      const perf = start > 0 ? equity / start - 1 : 0;
      return {
        userId: u.id,
        name: u.name || null,
        email: u.email,
        equity,
        perf
      };
    });

    // tri global perf desc puis email pour stabilité
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