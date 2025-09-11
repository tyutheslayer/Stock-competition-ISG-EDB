// pages/api/orders.csv.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// Convertit un tableau d’ordres en CSV simple
function toCsv(rows) {
  const headers = ["id", "symbol", "side", "quantity", "price", "createdAt"];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    return `"${String(v).replace(/"/g, '""')}"`;
  };

  const body = (Array.isArray(rows) ? rows : []).map(r => [
    esc(r.id),
    esc(r.symbol),
    esc(r.side),
    esc(r.quantity),
    esc(r.price),
    esc(new Date(r.createdAt).toISOString())
  ].join(",")).join("\n");

  return `${headers.join(",")}\n${body}\n`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).send("Méthode non supportée");
    }

    // Auth
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).send("Non authentifié");

    // Filtres optionnels
    const { from, to, side, limit } = req.query || {};
    const where = { userId: me.id };

    if (from) {
      const d = new Date(String(from));
      if (!isNaN(d)) where.createdAt = { ...(where.createdAt || {}), gte: d };
    }
    if (to) {
      const d = new Date(String(to));
      if (!isNaN(d)) where.createdAt = { ...(where.createdAt || {}), lte: d };
    }
    const SIDE = String(side || "").toUpperCase();
    if (SIDE === "BUY" || SIDE === "SELL") where.side = SIDE;

    const take = Number(limit) > 0 && Number(limit) <= 5000 ? Number(limit) : 1000;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        symbol: true,
        side: true,
        quantity: true,
        price: true,
        createdAt: true,
      },
    });

    const csv = toCsv(orders);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders_${me.id}.csv"`);
    return res.status(200).send(csv);
  } catch (e) {
    console.error("[orders.csv] fatal:", e);
    return res.status(500).send("Échec export CSV");
  }
}