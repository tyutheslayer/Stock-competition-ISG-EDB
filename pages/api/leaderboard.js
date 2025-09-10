import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  // naive leaderboard across all users
  const users = await prisma.user.findMany({});
  // gather all symbols
  const allPositions = await prisma.position.findMany({});
  const symbols = [...new Set(allPositions.map(p => p.symbol))];
  const prices = {};
  for (const s of symbols) {
    try {
      const q = await yahooFinance.quote(s);
      prices[s] = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? 0;
    } catch (e) {
      logError("leaderboard", e);
      res.status(500).json({ error: "Échec leaderboard", detail: e.message });
    }
  }
  // compute equity per user
  const equityByUser = {};
  for (const u of users) {
    equityByUser[u.id] = u.cash;
  }
  for (const p of allPositions) {
    const last = prices[p.symbol] || 0;
    equityByUser[p.userId] = (equityByUser[p.userId] || 0) + last * p.quantity;
  }
  const rows = users.map(u => {
    const equity = equityByUser[u.id] || u.cash;
    const perf = u.startingCash ? (equity / u.startingCash - 1) : 0;
    return { user: u.email, equity, perf };
  }).sort((a, b) => b.perf - a.perf).slice(0, 100);
  res.json(rows);
}
