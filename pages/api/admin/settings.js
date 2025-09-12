// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    // vérifie ADMIN
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    const isAdmin = me?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ error: "Interdit" });

    if (req.method === "GET") {
      const s = await prisma.settings.findUnique({ where: { id: 1 } });
      const tradingFeeBps = Number(s?.tradingFeeBps ?? 0);
      return res.json({ tradingFeeBps });
    }

    if (req.method === "PATCH") {
      const bpsRaw = req.body?.tradingFeeBps;
      const bps = Number.isFinite(Number(bpsRaw)) ? Math.max(0, Math.min(10000, Number(bpsRaw))) : 0;

      const s = await prisma.settings.upsert({
        where: { id: 1 },
        update: { tradingFeeBps: bps },
        create: { id: 1, tradingFeeBps: bps },
      });

      return res.json({ tradingFeeBps: s.tradingFeeBps });
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings]", e);
    return res.status(500).json({ error: "Échec settings admin" });
  }
}