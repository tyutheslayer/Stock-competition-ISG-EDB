// pages/api/order.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";
import { logError } from "../../lib/logger";

// Helper FX: renvoie le taux de conversion ccy -> EUR (nombre)
// Essaie d'abord "CCYEUR=X", sinon inverse "EURCCY=X".
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
  return null; // on signalera l’erreur au caller
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

    // Payload
    const { symbol, side, quantity } = req.body || {};
    const SIDE = String(side || "").toUpperCase();
    const qtyNum = Number(quantity);

    if (typeof symbol !== "string" || !symbol.trim())
      return res.status(400).send("Paramètres invalides");
    if (!["BUY", "SELL"].includes(SIDE))
      return res.status(400).send("Side invalide");
    if (!Number.isFinite(qtyNum) || qtyNum <= 0)
      return res.status(400).send("Quantité invalide");

    // Prix natif via yahoo-finance2
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

    // Taux FX -> EUR pour débiter/créditer le cash en euros
    const rate = await fxToEUR(ccy);
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(400).send("Taux FX indisponible");
    }

    if (SIDE === "BUY") {
      // 💶 coût en euros
      const costEUR = price * qtyNum * rate;
      if (user.cash < costEUR) return res.status(400).send("Solde insuffisant");

      // upsert position (prix/avg en devise native)
      const existing = await prisma.position.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
        select: { id: true, quantity: true, avgPrice: true }
      });

      if (existing) {
        const newQty = existing.quantity + qtyNum;
        const newAvg =
          (existing.avgPrice * existing.quantity + price * qtyNum) / newQty;

        await prisma.position.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgPrice: newAvg, name }
        });
      } else {
        await prisma.position.create({
          data: {
            userId: user.id,
            symbol,
            name,
            quantity: qtyNum,
            avgPrice: price
          }
        });
      }

      // Débit cash en EUR
      await prisma.user.update({
        where: { id: user.id },
        data: { cash: user.cash - costEUR }
      });

      // On enregistre l'ordre au prix natif
      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });

    } else {
      // SELL
      const existing = await prisma.position.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
        select: { id: true, quantity: true }
      });
      if (!existing || existing.quantity < qtyNum)
        return res.status(400).send("Position insuffisante");

      const proceedsEUR = price * qtyNum * rate; // 💶 produit en euros
      const remaining = existing.quantity - qtyNum;

      if (remaining <= 0) {
        await prisma.position.delete({ where: { id: existing.id } });
      } else {
        await prisma.position.update({
          where: { id: existing.id },
          data: { quantity: remaining }
        });
      }

      // Crédit cash en EUR
      await prisma.user.update({
        where: { id: user.id },
        data: { cash: user.cash + proceedsEUR }
      });

      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });
    }

    return res.json({
      ok: true,
      symbol: symbol.toUpperCase(),
      side: SIDE,
      quantity: qtyNum,
      price,       // prix natif
      currency: ccy,
      eurRate: rate
    });
  } catch (e) {
    logError("order", e);
    res.status(500).json({ error: "Échec ordre", detail: e.message });
  }
}