import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.error("[watchlist] 401 no session");
      return res.status(401).json({ error: "Non authentifié" });
    }
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });
    if (!me) {
      console.error("[watchlist] 401 user not found");
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (req.method === "GET") {
      const rows = await prisma.watchlist.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
        select: { symbol: true, name: true, createdAt: true }
      });
      return res.json(rows);
    }

    if (req.method === "POST") {
      const { symbol, name } = req.body || {};
      if (!symbol) return res.status(400).json({ error: "Symbol requis" });
      try {
        await prisma.watchlist.upsert({
          where: { userId_symbol: { userId: me.id, symbol } },
          update: { name: name || undefined },
          create: { userId: me.id, symbol, name: name || null }
        });
        return res.json({ ok: true });
      } catch (e) {
        console.error("[watchlist][POST] upsert error:", e);
        return res.status(500).json({ error: "Échec ajout favori" });
      }
    }

    if (req.method === "DELETE") {
      const { symbol } = req.body || {};
      if (!symbol) return res.status(400).json({ error: "Symbol requis" });
      try {
        await prisma.watchlist.delete({
          where: { userId_symbol: { userId: me.id, symbol } }
        });
      } catch (e) {
        // si déjà absent, on ne casse pas l'UX
        console.warn("[watchlist][DELETE] delete error (ignore if not found):", e?.code || e?.message);
      }
      return res.json({ ok: true });
    }

    res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[watchlist] fatal:", e);
    return res.status(500).json({ error: "Échec watchlist" });
  }
}