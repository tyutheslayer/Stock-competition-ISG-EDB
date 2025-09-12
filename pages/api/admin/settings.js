// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

/** Fallback KV dans VerificationToken
 *  key: "SETTINGS", token: "TRADING_FEE_BPS", value => expires.getTime() converti en int… NON.
 *  On stocke la valeur dans `token` et on fige `identifier = 'SETTINGS:TRADING_FEE_BPS'`.
 */
const KV_IDENTIFIER = "SETTINGS:TRADING_FEE_BPS";

async function kvGetTradingFeeBps() {
  const row = await prisma.verificationToken.findUnique({
    where: { token: KV_IDENTIFIER },
  }).catch(() => null);

  if (!row) return 0;
  const n = Number(row.identifier); // on met la valeur dans `identifier` pour avoir un index + token unique
  return Number.isFinite(n) ? n : 0;
}

async function kvSetTradingFeeBps(bps) {
  // valeur bornée côté API
  const value = Math.max(0, Math.min(10000, Number(bps) || 0));

  await prisma.verificationToken.upsert({
    where: { token: KV_IDENTIFIER },
    update: { identifier: String(value), expires: new Date("2999-12-31") },
    create: {
      identifier: String(value),
      token: KV_IDENTIFIER,
      expires: new Date("2999-12-31"),
      createdAt: new Date()
    }
  });

  return value;
}

// Essaie d’utiliser le modèle Settings s’il existe dans le client Prisma.
// Si le client n’a pas été régénéré avec ce modèle, `prisma.settings` sera undefined.
function hasSettingsModel() {
  return !!prisma?.settings;
}

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

    // ---- GET ----
    if (req.method === "GET") {
      if (hasSettingsModel()) {
        try {
          const s = await prisma.settings.findUnique({ where: { id: 1 } });
          const tradingFeeBps = Number(s?.tradingFeeBps ?? 0);
          return res.json({ tradingFeeBps });
        } catch (e) {
          // si la table n’existe pas réellement en DB
        }
      }
      // fallback KV
      const tradingFeeBps = await kvGetTradingFeeBps();
      return res.json({ tradingFeeBps });
    }

    // ---- PATCH ----
    if (req.method === "PATCH") {
      const raw = req.body?.tradingFeeBps;
      const bps = Math.max(0, Math.min(10000, Number(raw) || 0));

      if (hasSettingsModel()) {
        try {
          const s = await prisma.settings.upsert({
            where: { id: 1 },
            update: { tradingFeeBps: bps },
            create: { id: 1, tradingFeeBps: bps },
          });
          return res.json({ tradingFeeBps: Number(s?.tradingFeeBps ?? 0) });
        } catch (e) {
          // retombe sur KV si la table n’existe pas en prod
        }
      }

      const saved = await kvSetTradingFeeBps(bps);
      return res.json({ tradingFeeBps: saved });
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[admin/settings]", e);
    return res.status(500).json({ error: "Échec settings admin" });
  }
}