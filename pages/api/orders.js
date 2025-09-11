// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

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
      ].join(",")
    );
  }
  return lines.join("\n");
}
async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 =
      q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 =
      q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  return 1;
}

export default async function handler(req, res) {
  try {
    // Auth
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).send("Non authentifié");

    // Only GET (list/export)
    if (req.method !== "GET")
      return res.status(405).json({ error: "Méthode non supportée" });

    // Filters
    const from = toDate(req.query.from);
    const to = toDate(req.query.to);
    const side = String(req.query.side || "").toUpperCase();
    const limit = Math.max(
      1,
      Math.min(1000, parseInt(req.query.limit ?? "500", 10) || 500)
    );

    const where = {
      userId: me.id,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
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
        price: true, // natif (ex: USD)
        createdAt: true,
      },
    });

    // Quote each symbol once to get currency + FX rate
    const symbols = [...new Set(orders.map((o) => o.symbol))];
    const symMeta = {}; // { [symbol]: { currency, rateToEUR } }
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const ccy = q?.currency || "EUR";
        const rate = await fxToEUR(ccy);
        symMeta[s] = { currency: ccy, rateToEUR: rate };
      } catch {
        symMeta[s] = { currency: "EUR", rateToEUR: 1 };
      }
    }

    // Enrich with EUR fields
    const enriched = orders.map((o) => {
      const meta = symMeta[o.symbol] || { currency: "EUR", rateToEUR: 1 };
      const qty = Number(o.quantity || 0);
      const px = Number(o.price || 0);
      const rate = Number(meta.rateToEUR || 1);
      const priceEUR = px * rate;
      const totalEUR = qty * priceEUR;
      return {
        ...o,
        currency: meta.currency,
        rateToEUR: rate,
        priceEUR,
        totalEUR,
      };
    });

    // CSV or JSON?
    const wantsCsv =
      String(req.query.format || "").toLowerCase() === "csv" ||
      (req.headers?.accept || "").toLowerCase().includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(enriched);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${me.id}.csv"`
      );
      return res.status(200).send(csv);
    }

    return res.json(enriched);
  } catch (e) {
    // Ne casse pas l’UX — retourne JSON avec erreur
    console.error("[orders][GET] fatal:", e);
    return res.status(500).json({ error: "Échec récupération ordres" });
  }
}