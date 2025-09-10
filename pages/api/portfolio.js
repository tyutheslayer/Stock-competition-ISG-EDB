// pages/api/portfolio.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, cash: true }
    });
    if (!user) return res.status(401).send("Non authentifié");

    const positions = await prisma.position.findMany({
      where: { userId: user.id },
      select: { symbol: true, name: true, quantity: true, avgPrice: true }
    });

    // Récupère les dernières cotes directement via yahoo-finance2
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const prices = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        prices[s] =
          (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
          (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
          (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
          0;
      } catch {
        prices[s] = 0;
      }
    }

    const enriched = positions.map(p => {
      const last = Number(prices[p.symbol] || 0);
      const q = Number(p.quantity || 0);
      const avg = Number(p.avgPrice || 0);
      const marketValue = last * q;
      const pnl = (last - avg) * q;
      const pnlPct = avg > 0 ? ((last - avg) / avg) * 100 : 0;
      return { ...p, last: last || null, marketValue, pnl, pnlPct };
    });

    const positionsValue = enriched.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const equity = Number(user.cash || 0) + positionsValue;

    return res.json({
      positions: enriched,
      cash: Number(user.cash || 0),
      positionsValue,
      equity
    });
  } catch (e) {
    console.error("[portfolio]", e);
    return res.status(500).json({ error: "Échec chargement portefeuille", detail: e.message });
  }
}