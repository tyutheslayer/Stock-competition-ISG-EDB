// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    // Auth + autorisation admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }  // <-- pas de isAdmin (n’existe pas dans ton schema)
    });
    const isAdmin = me?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ error: "Accès refusé" });

    // Assure qu’une ligne Settings#1 existe
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, tradingFeeBps: 0 },
      select: { id: true, tradingFeeBps: true, createdAt: true, updatedAt: true }
    });

    if (req.method === "GET") {
      return res.json({
        tradingFeeBps: settings.tradingFeeBps,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      });
    }

    if (req.method === "PATCH") {
      const bps = Number(req.body?.tradingFeeBps);
      if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
        return res.status(400).json({ error: "tradingFeeBps invalide (0..10000)" });
      }
      const updated = await prisma.settings.update({
        where: { id: 1 },
        data: { tradingFeeBps: Math.round(bps) }, // entier en bps
        select: { tradingFeeBps: true, createdAt: true, updatedAt: true }
      });
      return res.json({
        tradingFeeBps: updated.tradingFeeBps,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings] fatal:", e);
    return res.status(500).json({ error: "Échec settings admin" });
  }
}