// pages/api/leaderboard.js
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
        prices[s] =
          (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
          (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
          (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
          0;
      } catch (e) {
        logError("leaderboard_quote", e);
        prices[s] = 0;
      }
    }

    // Equity = cash + Σ(last * qty)
    const equityByUser = {};
    for (const u of users) equityByUser[u.id] = Number(u.cash || 0);
    for (const p of allPositions) {
      const last = Number(prices[p.symbol] || 0);
      equityByUser[p.userId] = (equityByUser[p.userId] || 0) + last * Number(p.quantity || 0);
    }

    const rows = users.map(u => {
      const equity = equityByUser[u.id] ?? Number(u.cash || 0);
      const base = Number.isFinite(Number(u.startingCash)) && Number(u.startingCash) > 0
        ? Number(u.startingCash)
        : 100000; // fallback si startingCash manquant
      const perfPct = ((equity / base) - 1) * 100;
      return {
        id: u.id,
        name: u.name || null,
        email: u.email,
        equity,
        perfPct
      };
    }).sort((a, b) => b.perfPct - a.perfPct).slice(0, 100);

    res.json(rows);
  } catch (e) {
    logError("leaderboard", e);
    res.status(500).json({ error: "Échec leaderboard", detail: e.message });
  }
}