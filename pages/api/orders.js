// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// petit utilitaire CSV (échappement basique)
function toCsv(rows) {
  const headers = [
    "date",
    "user",
    "email",
    "symbol",
    "side",
    "quantity",
    "price_eur",
    "total_eur",
    "order_id",
  ];
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const qty = Number(r.quantity || 0);
    const price = Number(r.price || 0);
    const total = qty * price;
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        r.userName || "",
        r.userEmail || "",
        r.symbol || "",
        r.side || "",
        qty,
        price,
        total,
        r.id || "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  try {
    // Auth
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    // Params filtre
    const { from, to, side, limit } = req.query || {};
    const where = {
      user: { email: session.user.email },
    };
    // bornes de dates (ISO)
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (side && (side === "BUY" || side === "SELL")) {
      where.side = side;
    }

    const take = Math.max(1, Math.min(2000, parseInt(limit || "500", 10) || 500));

    // On récupère aussi name/email pour le CSV
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });
    if (!me) return res.status(401).send("Non authentifié");

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        symbol: true,
        side: true,
        quantity: true,
        price: true, // ⚠️ déjà en EUR depuis le patch order.js
        createdAt: true,
      },
    });

    // ---- Détection CSV robuste ----
    const url = req.url || "";
    const urlWantsCsv = url.includes("/api/orders.csv"); // ex: action="/api/orders.csv"
    const queryWantsCsv =
      String(req.query?.format || "").toLowerCase() === "csv";
    const accept = String(req.headers?.accept || "").toLowerCase();
    const headerWantsCsv = accept.includes("text/csv");
    const wantsCsv = urlWantsCsv || queryWantsCsv || headerWantsCsv;

    if (wantsCsv) {
      // enrichit pour CSV (userName/email)
      const rows = orders.map((o) => ({
        ...o,
        userName: me.name || "",
        userEmail: me.email || "",
      }));
      const csv = toCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${(me.name || me.email || "me")
          .replace(/[^a-z0-9._-]/gi, "_")
          .toLowerCase()}.csv"`
      );
      return res.status(200).send(csv);
    }

    // Sinon JSON
    return res.json(
      orders.map((o) => ({
        ...o,
        userName: me.name || null,
        userEmail: me.email || null,
      }))
    );
  } catch (e) {
    console.error("[orders] fatal:", e);
    return res.status(500).json({ error: "Échec chargement ordres", detail: e.message });
  }
}