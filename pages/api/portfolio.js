import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

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

    // Récupère les derniers prix via l'API interne (quote)
    const enriched = [];
    for (const p of positions) {
      try {
        const r = await fetch(`${process.env.NEXTAUTH_URL || ""}/api/quote/${encodeURIComponent(p.symbol)}`);
        const q = r.ok ? await r.json() : null;
        const last = Number(q?.price ?? NaN);
        const marketValue = Number.isFinite(last) ? last * Number(p.quantity) : 0;
        const pnl = Number.isFinite(last) ? (last - Number(p.avgPrice)) * Number(p.quantity) : 0;
        const pnlPct = Number(p.avgPrice) > 0 ? ((last - Number(p.avgPrice)) / Number(p.avgPrice)) * 100 : 0;
        enriched.push({ ...p, last: Number.isFinite(last) ? last : null, marketValue, pnl, pnlPct });
      } catch {
        enriched.push({ ...p, last: null, marketValue: 0, pnl: 0, pnlPct: 0 });
      }
    }

    const positionsValue = enriched.reduce((sum, p) => sum + (p.marketValue || 0), 0);
    const equity = user.cash + positionsValue;

    return res.json({
      positions: enriched,
      cash: user.cash,
      positionsValue,
      equity
    });
  } catch (e) {
    console.error("[portfolio]", e);
    return res.status(500).json({ error: "Échec chargement portefeuille", detail: e.message });
  }
}
