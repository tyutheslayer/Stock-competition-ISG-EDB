import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

/**
 * PATCH /api/watchlist/reorder
 * Body: { symbols: string[] }
 * Réordonne la watchlist de l'utilisateur courant selon l'ordre donné.
 */
export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  });
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const { symbols } = req.body || {};
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: "symbols[] requis" });
  }

  try {
    await prisma.$transaction(
      symbols.map((sym, idx) =>
        prisma.watchlist.update({
          where: { userId_symbol: { userId: me.id, symbol: sym } },
          data: { rank: idx }
        })
      )
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("[watchlist][reorder]", e);
    return res.status(500).json({ error: "Échec réordonnancement" });
  }
}