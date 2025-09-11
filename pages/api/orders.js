// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

/**
 * Utilitaire très simple pour convertir en CSV.
 * Échappe les guillemets et entoure chaque champ.
 */
function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "id,symbol,side,quantity,price,createdAt\n";
  }
  const headers = ["id", "symbol", "side", "quantity", "price", "createdAt"];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = headers.join(",");
  const body = rows
    .map((r) =>
      [
        esc(r.id),
        esc(r.symbol),
        esc(r.side),
        esc(r.quantity),
        esc(r.price),
        esc(new Date(r.createdAt).toISOString()),
      ].join(",")
    )
    .join("\n");
  return `${head}\n${body}\n`;
}

export default async function handler(req, res) {
  try {
    // Auth obligatoire
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "Non authentifié" });

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    // Filtres: ?from=ISO&to=ISO&side=BUY|SELL|ALL&format=json|csv
    const { from, to, side, format } = req.query || {};
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
    if (SIDE === "BUY" || SIDE === "SELL") {
      where.side = SIDE;
    }

    // Récupération (tri du plus récent au plus ancien)
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        symbol: true,
        side: true,
        quantity: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // CSV si demandé par query ?format=csv ou si Accept: text/csv
    const wantsCsv =
      (format && String(format).toLowerCase() === "csv") ||
      (req.headers?.accept || "").toLowerCase().includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(orders);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${me.id}.csv"`
      );
      return res.status(200).send(csv);
    }

    // JSON par défaut
    return res.json(orders);
  } catch (e) {
    console.error("[orders] fatal:", e);
    return res.status(500).json({ error: "Échec récupération ordres" });
  }
}