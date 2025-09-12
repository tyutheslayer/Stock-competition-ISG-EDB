// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

const FALLBACK_BPS = Number(process.env.DEFAULT_TRADING_FEE_BPS ?? 0);

async function readFromDb() {
  try {
    // id=1 convention
    const row = await prisma.settings.findUnique({ where: { id: 1 } });
    if (row && typeof row.tradingFeeBps === "number") {
      return { tradingFeeBps: row.tradingFeeBps, source: "db" };
    }
    // si la table existe mais vide → default 0
    return { tradingFeeBps: 0, source: "db" };
  } catch (e) {
    // modèle/tables absents → fallback env
    return { tradingFeeBps: FALLBACK_BPS, source: "env" };
  }
}

export default async function handler(req, res) {
  // auth + admin
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  const isAdmin = me?.role === "ADMIN";
  if (!isAdmin) return res.status(403).send("Accès refusé");

  if (req.method === "GET") {
    const data = await readFromDb();
    return res.json(data);
  }

  if (req.method === "PUT") {
    const { tradingFeeBps } = req.body || {};
    const bps = Number(tradingFeeBps);
    if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
      return res.status(400).json({ error: "Bps invalide (0 à 10000)" });
    }

    // essaie d’écrire en DB; si la table n’existe pas, explique
    try {
      await prisma.settings.upsert({
        where: { id: 1 },
        update: { tradingFeeBps: bps },
        create: { id: 1, tradingFeeBps: bps },
      });
      return res.json({ ok: true, tradingFeeBps: bps, source: "db" });
    } catch (e) {
      return res
        .status(501)
        .json({
          error:
            "Persistance indisponible (table Settings absente). Utilisez DEFAULT_TRADING_FEE_BPS en environnement.",
          tradingFeeBps: FALLBACK_BPS,
          source: "env",
        });
    }
  }

  return res.status(405).end();
}