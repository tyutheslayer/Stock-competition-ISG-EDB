import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, cash: true, startingCash: true }
    });
    const allPositions = await prisma.position.findMany({
      select: { userId: true, symbol: true, quantity: true }
    });

    const symbols = [...new Set(allPositions.map(p => p.symbol))];
    const prices = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        prices[s] = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? 0;
      } catch (e) {
        logError("leaderboard_quote", e);
        prices[s] = 0; // on continue même si une quote échoue
      }
    }

    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash || 0);
    for (const p of allPositions) {
      const last = Number(prices[p.symbol] || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + last * Number(p.quantity || 0);
    }

    const rows = users.map(u => {
      const equity = equityByUser[u.id] ?? Number(u.cash || 0);
      const perf = u.startingCash ? equity / Number(u.startingCash) - 1 : 0;
      return {
        id: u.id,
        name: u.name || null,
        email: u.email,
        equity,
        perfPct: perf * 100
      };
    }).sort((a, b) => (b.perfPct - a.perfPct)).slice(0, 100);

    res.json(rows);
  } catch (e) {
    logError("leaderboard", e);
    res.status(500).json({ error: "Échec leaderboard", detail: e.message });
  }
}
