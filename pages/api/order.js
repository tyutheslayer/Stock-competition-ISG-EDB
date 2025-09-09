import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  try {
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
    const qtyNum = Number.parseFloat(quantity);

    if (!symbol || !SIDE || !Number.isFinite(qtyNum) || qtyNum <= 0)
      return res.status(400).send("Paramètres invalides");
    if (!["BUY", "SELL"].includes(SIDE))
      return res.status(400).send("Side invalide");

    // Prix via yahoo-finance2
    let price = null;
    let name = symbol;
    try {
      const q = await yahooFinance.quote(symbol);
      price = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? null;
      name = q?.shortName || q?.longName || symbol;
    } catch (e) {
      // on laisse tomber dans le catch global pour voir l'erreur exacte
      throw e;
    }
    if (!Number.isFinite(price) || price <= 0) return res.status(400).send("Prix indisponible");

    if (SIDE === "BUY") {
      const cost = price * qtyNum;
      if (user.cash < cost) return res.status(400).send("Solde insuffisant");

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
        data: { cash: user.cash - cost }
      });

      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });

    } else if (SIDE === "SELL") {
      const existing = await prisma.position.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
        select: { id: true, quantity: true }
      });
      if (!existing || existing.quantity < qtyNum) return res.status(400).send("Position insuffisante");

      const proceeds = price * qtyNum;
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
        data: { cash: user.cash + proceeds }
      });

      await prisma.order.create({
        data: { userId: user.id, symbol, side: SIDE, quantity: qtyNum, price }
      });
    }

    return res.json({ ok: true, price, symbol, side: SIDE, quantity: qtyNum });
  } catch (e) {
    console.error("Échec ordre:", e);
    const detail = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ error: "Échec ordre", detail });
  }
}
