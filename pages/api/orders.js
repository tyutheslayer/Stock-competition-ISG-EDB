import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

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

function toCsv(rows) {
  const head = ["date","symbol","side","quantity","price_eur","total_eur"].join(",");
  const body = rows.map(r => [
    new Date(r.createdAt).toISOString(),
    r.symbol,
    r.side,
    r.quantity,
    r.eurPrice?.toFixed?.(6) ?? "",
    r.eurTotal?.toFixed?.(2) ?? ""
  ].join(","));
  return [head, ...body].join("\n");
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });
    if (!me) return res.status(401).send("Non authentifié");

    const { from, to, side, limit } = req.query || {};
    const take = Math.min(1000, Math.max(1, parseInt(limit || "500", 10) || 500));

    const where = { userId: me.id };
    if (side && (side === "BUY" || side === "SELL")) where.side = side;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take
    });

    // enrichi EUR
    // NB: on quote par symbol unique pour récupérer la devise & taux
    const symbols = [...new Set(orders.map(o => o.symbol))];
    const ccyBySymbol = {};
    const rateByCcy = {};

    for (const s of symbols) {
      try {
        const q = await yahooFinance.quote(s);
        const ccy = q?.currency || "EUR";
        ccyBySymbol[s] = ccy;
        if (!(ccy in rateByCcy)) rateByCcy[ccy] = await fxToEUR(ccy);
      } catch {
        ccyBySymbol[s] = "EUR";
        rateByCcy["EUR"] = 1;
      }
    }

    const rows = orders.map(o => {
      const ccy = ccyBySymbol[o.symbol] || "EUR";
      const rate = rateByCcy[ccy] || 1;
      const eurPrice = Number(o.price || 0) * rate;
      const eurTotal = eurPrice * Number(o.quantity || 0);
      return { ...o, eurPrice, eurTotal };
    });

    const format = (req.query?.format || "").toLowerCase();
    const wantsCsv =
      (format === "csv") ||
      (req.headers?.accept || "").toLowerCase().includes("text/csv");

    if (wantsCsv) {
      const csv = toCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="orders_${me.id}.csv"`);
      return res.status(200).send(csv);
    }

    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: "Échec orders", detail: e?.message || String(e) });
  }
}