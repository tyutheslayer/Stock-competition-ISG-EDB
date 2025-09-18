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

/** bps robustes : on prend la 1re source non nulle, sinon la valeur max trouvée */
async function getTradingFeeBpsRobust() {
  // 1) ENV
  const envBps = Number(process.env.TRADING_FEE_BPS);
  if (Number.isFinite(envBps) && envBps > 0) return Math.floor(envBps);

  // 2) DB directe
  try {
    const row = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { tradingFeeBps: true },
    });
    const b = Number(row?.tradingFeeBps);
    if (Number.isFinite(b) && b > 0) return b;
  } catch {}

  // 3) getSettings() (peut être mise en cache côté app)
  try {
    const s = await getSettings();
    const b = Number(s?.tradingFeeBps);
    if (Number.isFinite(b) && b >= 0) return b;
  } catch {}

  return 0;
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

    // --- Frais (bps) robustes ---
    const tradingFeeBps = await getTradingFeeBpsRobust();
    const feePct = Math.max(0, Number(tradingFeeBps) || 0) / 10000;

    // --- Meta par symbole via cache (devise + FX -> EUR) ---
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
      const total   = qty * pxEUR;                    // total "brut"
      const feeEUR  = +(total * feePct).toFixed(6);   // précision API
      const impact  = o.side === "BUY" ? -(total + feeEUR) : (total - feeEUR);

      return {
        ...o,
        currency: meta.currency,
        rateToEUR: rate,
        priceEUR: pxEUR,
        totalEUR: total,
        feeBps: tradingFeeBps,
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