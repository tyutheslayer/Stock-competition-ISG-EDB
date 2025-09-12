// pages/api/order.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

const FALLBACK_BPS = Number(process.env.DEFAULT_TRADING_FEE_BPS ?? 0);

// Helper FX
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
  return null;
}

async function getTradingFeeBps() {
  try {
    const row = await prisma.settings.findUnique({ where: { id: 1 } });
    if (row && typeof row.tradingFeeBps === "number") return row.tradingFeeBps;
  } catch {}
  return FALLBACK_BPS;
}

export default async function handler(req, res) {
  try {
    // Auth
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).send("Non authentifié");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, cash: true }
    });
    if (!user) return res.status(401).send("Non authentifié");

    if (req.method !== "POST") return res.status(405).end();

    const { symbol, side, quantity } = req.body || {};
    const SIDE = String(side || "").toUpperCase();
    const qtyNum = Number(quantity);

    if (typeof symbol !== "string" || !symbol.trim())
      return res.status(400).send("Paramètres invalides");
    if (!["BUY", "SELL"].includes(SIDE))
      return res.status(400).send("Side invalide");
    if (!Number.isFinite(qtyNum) || qtyNum <= 0)
      return res.status(400).send("Quantité invalide");

    // Quote natif
    const q = await yahooFinance.quote(symbol);
    const price =
      (typeof q?.regularMarketPrice === "number" && q.regularMarketPrice) ??
      (typeof q?.postMarketPrice === "number" && q.postMarketPrice) ??
      (typeof q?.preMarketPrice === "number" && q.preMarketPrice) ??
      null;
    const name = q?.shortName || q?.longName || symbol;
    const ccy  = q?.currency || "EUR";

    if (!Number.isFinite(price) || price <= 0)
      return res.status(400).send("Prix indisponible");

    const rate = await fxToEUR(ccy);
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(400).send("Taux FX indisponible");
    }

    const feeBps = await getTradingFeeBps();
    const feeRate = Math.max(0, Number(feeBps) || 0) / 10000;

    if (SIDE === "BUY") {
      // coût EUR + frais
      const notionalEUR = price * qtyNum * rate;
      const feeEUR = notionalEUR * feeRate;
      const totalEUR = notionalEUR + feeEUR;

      if (user.cash < totalEUR) return res.status(400).send("Solde insuffisant");

      // positions en prix natif (avg natif)
      const existing = await prisma.position.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
        select: { id: true, quantity: true, avgPrice: true }
      });

      if (existing) {
        const newQty = existing.quantity + qtyNum;
        const newAvg = (existing.avgPrice * existing.quantity + price * qtyNum) / newQty;
        await prisma.position.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgPrice: newAvg, name }
        });
      } else {
        await prisma.position.create({
          data: { userId: user.id, symbol, name, quantity: qtyNum, avgPrice: price }
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { cash: user.cash - totalEUR }
      });

      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });

      return res.json({
        ok: true,
        symbol: symbol.toUpperCase(),
        side: SIDE,
        quantity: qtyNum,
        price,
        currency: ccy,
        eurRate: rate,
        feeBps,
        debitedEUR: totalEUR
      });
    } else {
      // SELL
      const existing = await prisma.position.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
        select: { id: true, quantity: true }
      });
      if (!existing || existing.quantity < qtyNum)
        return res.status(400).send("Position insuffisante");

      const notionalEUR = price * qtyNum * rate;
      const feeEUR = notionalEUR * feeRate;
      const netEUR = notionalEUR - feeEUR;
      const remaining = existing.quantity - qtyNum;

      if (remaining <= 0) {
        await prisma.position.delete({ where: { id: existing.id } });
      } else {
        await prisma.position.update({
          where: { id: existing.id },
          data: { quantity: remaining }
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { cash: user.cash + netEUR }
      });

      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });

      return res.json({
        ok: true,
        symbol: symbol.toUpperCase(),
        side: SIDE,
        quantity: qtyNum,
        price,
        currency: ccy,
        eurRate: rate,
        feeBps,
        creditedEUR: netEUR
      });
    }
  } catch (e) {
    logError("order", e);
    res.status(500).json({ error: "Échec ordre", detail: e.message });
  }
}