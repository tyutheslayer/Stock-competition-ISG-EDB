// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email || null;
    if (!email) return res.status(401).json({ error: "Non authentifié" });

    // vérifier admin (role === ADMIN ou isAdmin vrai si tu l'as)
    const me = await prisma.user.findUnique({
      where: { email },
      select: { role: true, isAdmin: true }
    });
    const isAdmin = me?.role === "ADMIN" || me?.isAdmin;
    if (!isAdmin) return res.status(403).json({ error: "Interdit" });

    if (req.method === "GET") {
      try {
        const s = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!s) {
          // fallback si la table n'existe pas ou pas de row
          const bpsEnv = Number(process.env.DEFAULT_TRADING_FEE_BPS || 0) || 0;
          return res.json({ exists: false, tradingFeeBps: bpsEnv });
        }
        return res.json({ exists: true, tradingFeeBps: s.tradingFeeBps });
      } catch {
        const bpsEnv = Number(process.env.DEFAULT_TRADING_FEE_BPS || 0) || 0;
        return res.json({ exists: false, tradingFeeBps: bpsEnv });
      }
    }

    if (req.method === "POST") {
      const { tradingFeeBps } = req.body || {};
      const bps = Math.max(0, Math.min(10000, parseInt(tradingFeeBps, 10) || 0)); // borne 0..10000
      // upsert Settings.id = 1
      try {
        const s = await prisma.settings.upsert({
          where: { id: 1 },
          update: { tradingFeeBps: bps },
          create: { id: 1, tradingFeeBps: bps }
        });
        return res.json({ ok: true, tradingFeeBps: s.tradingFeeBps, persisted: true });
      } catch (e) {
        // si la table n'existe pas
        return res.status(501).json({
          ok: false,
          persisted: false,
          tradingFeeBps: bps,
          error: "Table Settings absente. Applique la migration en prod.",
        });
      }
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings]", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}