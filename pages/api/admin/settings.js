// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // Vérifie ADMIN via le rôle enum (ta base utilise Role{USER,ADMIN})
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (me?.role !== "ADMIN") {
      return res.status(403).json({ error: "Interdit" });
    }

    if (req.method === "GET") {
      const s = await prisma.settings.findUnique({ where: { id: 1 } });
      return res.json({ tradingFeeBps: Number(s?.tradingFeeBps ?? 0) });
    }

    if (req.method === "PATCH") {
      const raw = req.body?.tradingFeeBps;
      // borne 0..10000 (0%..100%)
      const bps = Math.max(0, Math.min(10000, Number(raw || 0)));

      const saved = await prisma.settings.upsert({
        where: { id: 1 },
        update: { tradingFeeBps: bps },
        create: { id: 1, tradingFeeBps: bps },
      });
      return res.json({ tradingFeeBps: Number(saved.tradingFeeBps || 0) });
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings] fatal:", e);
    return res.status(500).json({ error: "Échec settings admin" });
  }
}