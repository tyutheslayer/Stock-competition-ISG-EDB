// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

/**
 * Crée la table "Settings" et la rangée id=1 si absentes (hotfix sans migrate).
 * Postgres only.
 */
async function ensureSettingsTableAndRow() {
  // 1) Crée la table si elle n’existe pas
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Settings" (
      "id" INTEGER PRIMARY KEY,
      "tradingFeeBps" INTEGER NOT NULL DEFAULT 0
    )
  `);

  // 2) Insère la ligne par défaut (id=1) si absente
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Settings" ("id", "tradingFeeBps")
    VALUES (1, 0)
    ON CONFLICT ("id") DO NOTHING
  `);
}

export default async function handler(req, res) {
  try {
    // Auth + admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true } // <-- ne pas demander isAdmin
    });
    const isAdmin = me?.role === "ADMIN"; // <-- calcule à partir du rôle
    if (!isAdmin) return res.status(403).json({ error: "Accès refusé" });

    if (req.method === "GET") {
      // Essaye d’abord, et s’il manque la table, auto-répare puis relit
      try {
        const row = await prisma.settings.findUnique({ where: { id: 1 } });
        if (!row) {
          await ensureSettingsTableAndRow();
          const row2 = await prisma.settings.findUnique({ where: { id: 1 } });
          return res.json({ tradingFeeBps: Number(row2?.tradingFeeBps || 0) });
        }
        return res.json({ tradingFeeBps: Number(row.tradingFeeBps || 0) });
      } catch (e) {
        // Si la table n’existe pas (P2021), on la crée puis on relit
        if (e?.code === "P2021") {
          await ensureSettingsTableAndRow();
          const row = await prisma.settings.findUnique({ where: { id: 1 } });
          return res.json({ tradingFeeBps: Number(row?.tradingFeeBps || 0) });
        }
        console.error("[admin/settings][GET] fatal:", e);
        return res.status(500).json({ error: "Échec settings admin" });
      }
    }

    if (req.method === "PATCH") {
      let { tradingFeeBps } = req.body || {};
      const bps = Math.max(0, Math.min(10000, parseInt(tradingFeeBps ?? 0, 10) || 0));

      // Assure la présence table + rangée
      await ensureSettingsTableAndRow();

      const saved = await prisma.settings.upsert({
        where: { id: 1 },
        update: { tradingFeeBps: bps },
        create: { id: 1, tradingFeeBps: bps }
      });

      return res.json({ tradingFeeBps: Number(saved.tradingFeeBps || 0) });
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings] fatal:", e);
    return res.status(500).json({ error: "Échec settings admin" });
  }
}