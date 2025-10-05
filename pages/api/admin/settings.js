// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    // Préflight / CORS simple si besoin
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      return res.status(200).end();
    }

    // Auth + autorisation admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    const isAdmin = me?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ error: "Accès refusé" });

    // Assure la présence d'une ligne id=1
    const base = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, tradingFeeBps: 0 },
      select: { id: true, tradingFeeBps: true, createdAt: true, updatedAt: true },
    });

    if (req.method === "GET") {
      return res.status(200).json({
        tradingFeeBps: base.tradingFeeBps,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      });
    }

    if (req.method === "PATCH" || req.method === "POST") {
      // Tolère string/number et arrondit à l'entier
      let bps = Number(
        typeof req.body?.tradingFeeBps === "string"
          ? req.body.tradingFeeBps.trim()
          : req.body?.tradingFeeBps
      );
      if (!Number.isFinite(bps)) {
        return res.status(400).json({ error: "tradingFeeBps invalide (NaN)" });
      }

      bps = Math.round(bps);
      if (bps < 0) bps = 0;
      if (bps > 10000) bps = 10000;

      const updated = await prisma.settings.update({
        where: { id: 1 },
        data: { tradingFeeBps: bps },
        select: { tradingFeeBps: true, createdAt: true, updatedAt: true },
      });

      return res.status(200).json({
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