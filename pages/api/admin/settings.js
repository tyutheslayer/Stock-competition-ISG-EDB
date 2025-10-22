// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      return res.status(200).end();
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
      return res.status(403).json({ error: "Accès refusé (ADMIN requis)" });
    }

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
      let bpsRaw = req.body?.tradingFeeBps;
      if (typeof bpsRaw === "string") bpsRaw = bpsRaw.trim();
      let bps = Number(bpsRaw);
      if (!Number.isFinite(bps)) {
        return res.status(400).json({ error: "tradingFeeBps invalide (NaN)", got: req.body?.tradingFeeBps });
      }
      bps = Math.min(10000, Math.max(0, Math.round(bps)));

      const updated = await prisma.settings.update({
        where: { id: 1 },
        data: { tradingFeeBps: bps },
        select: { tradingFeeBps: true, createdAt: true, updatedAt: true },
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings] fatal:", e);
    return res.status(500).json({
      error: "Échec settings admin",
      detail: e?.message || String(e),
      code: e?.code || null,
    });
  }
}