// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

function toCsv(orders, user) {
  // séparateur ; pour l’Excel FR
  const header = [
    "date",
    "user",
    "email",
    "symbol",
    "side",
    "quantity",
    "price",
    "total"
  ].join(";");

  const rows = orders.map((o) => {
    const qty = Number(o.quantity || 0);
    const price = Number(o.price || 0);
    const total = qty * price;
    const date = new Date(o.createdAt).toISOString(); // ISO lisible/triable

    // Échappe le ; et les retours lignes si un jour tu ajoutes des champs texte
    const esc = (v) =>
      String(v ?? "")
        .replace(/\r?\n/g, " ")
        .replace(/;/g, ",");

    return [
      esc(date),
      esc(user?.name || ""),  // <- nom dans le CSV
      esc(user?.email || ""),
      esc(o.symbol),
      esc(o.side),
      qty,
      price.toString().replace(".", ","),  // format FR
      total.toString().replace(".", ",")
    ].join(";");
  });

  return [header, ...rows].join("\n");
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    // Qui suis-je ? (pour nom/email dans le CSV)
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true }
    });
    if (!me) return res.status(401).json({ error: "Non authentifié" });

    // Filtres
    const { from, to, side, limit } = req.query;
    const take = Math.min(1000, Math.max(1, parseInt(limit ?? "500", 10) || 500));
    const where = { userId: me.id };
    if (side && (side === "BUY" || side === "SELL")) where.side = side;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take
    });

    // --- CSV ou JSON ? ---
    const format = (req.query.format || "").toString().toLowerCase();
    const accept = (req.headers?.accept || "").toLowerCase();
    const wantsCsv = format === "csv" || accept.includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(orders, me);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${me.email || me.id}.csv"`
      );
      return res.status(200).send(csv);
    }

    // Sinon JSON (UI)
    return res.status(200).json(orders);
  } catch (e) {
    console.error("[orders] fatal:", e);
    return res.status(500).json({ error: "Échec chargement des ordres" });
  }
}