import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });

  const positions = await prisma.position.findMany({ where: { userId: user.id } });
  // fetch quotes for each unique symbol
  const unique = [...new Set(positions.map(p => p.symbol))];
  const quotes = {};
  for (const s of unique) {
    try {
      const q = await yahooFinance.quote(s);
      quotes[s] = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? null;
    } catch (e) {
      quotes[s] = null;
    }
  }
  const enriched = positions.map(p => {
    const last = quotes[p.symbol] ?? 0;
    const mv = last * p.quantity;
    const pnl = (last - p.avgPrice) * p.quantity;
    const pnlPct = p.avgPrice ? (last / p.avgPrice - 1) : 0;
    return { ...p, last, marketValue: mv, pnl, pnlPct };
  });
  const equity = user.cash + enriched.reduce((sum, p) => sum + p.marketValue, 0);
  res.json({ cash: user.cash, startingCash: user.startingCash, equity, positions: enriched });
}
