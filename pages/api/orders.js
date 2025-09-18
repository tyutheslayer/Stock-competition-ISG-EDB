// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import { getSettings } from "../../lib/settings";
import { getQuoteMeta } from "../../lib/quoteCache";

/* -------- Helpers -------- */
function toDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function toCsv(rows) {
  const header = [
    "date",
    "symbol",
    "side",
    "quantity",
    "price_native",
    "currency",
    "rate_to_eur",
    "price_eur",
    "total_eur",
    "fee_bps",
    "fee_eur",
    "cash_impact_eur",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        r.symbol,
        r.side,
        r.quantity,
        (Number(r.price) || 0).toString(),
        r.currency || "EUR",
        Number(r.rateToEUR || 1).toString(),
        Number(r.priceEUR || 0).toString(),
        Number(r.totalEUR || 0).toString(),
        Number(r.feeBps || 0).toString(),
        Number(r.feeEUR || 0).toString(),
        Number(r.cashImpactEUR || 0).toString(),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).send("Non authentifié");

    if (req.method !== "GET")
      return res.status(405).json({ error: "Méthode non supportée" });

    const from = toDate(req.query.from);
    const to = toDate(req.query.to);
    const side = String(req.query.side || "").toUpperCase();
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit ?? "500", 10) || 500));

    const where = {
      userId: me.id,
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(side === "BUY" || side === "SELL" ? { side } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        symbol: true,
        side: true,
        quantity: true,
        price: true, // natif
        createdAt: true,
      },
    });

    // ----- Settings (bps) avec fallbacks robustes -----
    let feeBps = 0;
    try {
      const s = await getSettings(); // lecture "normale"
      feeBps = Number(s?.tradingFeeBps ?? 0);
    } catch {}
    if (!(feeBps > 0)) {
      // fallback Prisma direct (première ligne Settings)
      try {
        const row = await prisma.settings.findFirst({
          select: { tradingFeeBps: true },
          orderBy: { id: "asc" },
        });
        feeBps = Number(row?.tradingFeeBps ?? 0);
      } catch {}
    }
    if (!(feeBps > 0)) {
      // fallback ENV éventuel
      feeBps = Number(process.env.TRADING_FEE_BPS ?? 0);
    }
    const feePct = Math.max(0, feeBps) / 10000;

    // ---- Meta par symbole via cache (devise + FX -> EUR) ----
    const symbols = [...new Set(orders.map((o) => o.symbol))];
    const symMeta = {};
    for (const s of symbols) {
      try {
        symMeta[s] = await getQuoteMeta(s);
      } catch {
        symMeta[s] = { currency: "EUR", rateToEUR: 1 };
      }
    }

    const enriched = orders.map((o) => {
      const meta = symMeta[o.symbol] || { currency: "EUR", rateToEUR: 1 };
      const qty  = Number(o.quantity || 0);
      const px   = Number(o.price || 0);
      const rate = Number(meta.rateToEUR || 1);

      const pxEUR   = px * rate;
      const total   = qty * pxEUR;         // total "brut"
      const feeEUR  = total * feePct;
      const impact  = o.side === "BUY" ? -(total + feeEUR) : (total - feeEUR); // net signé

      return {
        ...o,
        currency: meta.currency,
        rateToEUR: rate,
        priceEUR: pxEUR,
        totalEUR: total,
        feeBps,
        feeEUR,
        cashImpactEUR: impact,
      };
    });

    const wantsCsv =
      String(req.query.format || "").toLowerCase() === "csv" ||
      (req.headers?.accept || "").toLowerCase().includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(enriched);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="orders_${me.id}.csv"`);
      return res.status(200).send(csv);
    }

    return res.json(enriched);
  } catch (e) {
    console.error("[orders][GET] fatal:", e);
    return res.status(500).json({ error: "Échec récupération ordres" });
  }
}