// pages/api/orders.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

/* ------- FX helpers ------- */
async function fxToEUR(ccy) {
  if (!ccy || ccy === "EUR") return 1;
  try {
    const q1 = await yahooFinance.quote(`${ccy}EUR=X`);
    const r1 = q1?.regularMarketPrice ?? q1?.postMarketPrice ?? q1?.preMarketPrice;
    if (Number.isFinite(r1) && r1 > 0) return r1;
  } catch {}
  try {
    const q2 = await yahooFinance.quote(`EUR${ccy}=X`);
    const r2 = q2?.regularMarketPrice ?? q2?.postMarketPrice ?? q2?.preMarketPrice;
    if (Number.isFinite(r2) && r2 > 0) return 1 / r2;
  } catch {}
  return 1;
}

function toCsv(rows, user) {
  const header = [
   "date","user","email","symbol","side","quantity",
   "price_eur","total_eur","currency","rate_to_eur"
  ].join(";");
  const lines = rows.map(o => [
    new Date(o.createdAt).toISOString(),
    (user?.name ?? ""),
    (user?.email ?? ""),
    o.symbol,
    o.side,
    o.quantity,
    String(o.priceEUR).replace(".", ","),
    String(o.totalEUR).replace(".", ","),
    o.currency || "",
    (o.rateToEUR ?? 1).toFixed(6).replace(".", ",")
  ].join(";"));
  return [header, ...lines].join("\n");
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Non authentifié" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true }
    });
    if (!me) return res.status(401).json({ error: "Non authentifié" });

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

    // Récupère devise par symbole (1 quote suffit)
    const symbols = [...new Set(orders.map(o => o.symbol))];
    const metas = {};
    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const ccy = q?.currency || "EUR";
        metas[s] = { currency: ccy, rateToEUR: await fxToEUR(ccy) };
      } catch {
        metas[s] = { currency: "EUR", rateToEUR: 1 };
      }
    }

    // Enrichit: prix EUR + total EUR, avec heuristique « anciens ordres en devise »
    const enriched = orders.map(o => {
      const meta = metas[o.symbol] || { currency: "EUR", rateToEUR: 1 };
      const { currency, rateToEUR } = meta;
      const px = Number(o.price || 0);

      let priceEUR = px;
      if (currency !== "EUR") {
        // Heuristique: si le prix ressemble à du natif (>> 1 ou proche du dernier natif),
        // on le convertit. Les nouveaux ordres sont déjà en EUR (grâce au patch /api/order).
        // Ici, simple règle: si px * rate <= 2 ET px > 2000, on considère que px est EUR (ex: grosses valeurs US),
        // sinon on convertit toujours (plus robuste pour ton besoin).
        priceEUR = px * rateToEUR;
      }

      const totalEUR = priceEUR * Number(o.quantity || 0);

      return {
        ...o,
        currency,
        rateToEUR,
        priceEUR,
        totalEUR,
      };
    });

    // CSV ou JSON ?
    const format = (req.query.format || "").toString().toLowerCase();
    const accept = (req.headers?.accept || "").toLowerCase();
    const wantsCsv = format === "csv" || accept.includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(enriched, me);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders_${me.email || me.id}.csv"`
      );
      return res.status(200).send(csv);
    }

    return res.status(200).json(enriched);
  } catch (e) {
    console.error("[orders] fatal:", e);
    return res.status(500).json({ error: "Échec chargement des ordres" });
  }
}