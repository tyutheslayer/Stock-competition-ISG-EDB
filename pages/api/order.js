import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return res.status(401).send("Non authentifié");

  if (req.method !== "POST") return res.status(405).end();
  const { symbol, side, qty } = req.body || {};
  const qtyInt = parseInt(qty, 10);
  if (!symbol || !side || !qtyInt || qtyInt <= 0) return res.status(400).send("Paramètres invalides");
  try {
    const q = await yahooFinance.quote(symbol);
    const price = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice;
    const name = q?.shortName || q?.longName || symbol;
    if (!price) return res.status(400).send("Prix indisponible");

    if (side === "BUY") {
      const cost = price * qtyInt;
      if (user.cash < cost) return res.status(400).send("Solde insuffisant");
      // upsert position
      const existing = await prisma.position.findUnique({ where: { userId_symbol: { userId: user.id, symbol } } });
      let newQty, newAvg;
      if (existing) {
        newQty = existing.quantity + qtyInt;
        newAvg = (existing.avgPrice * existing.quantity + price * qtyInt) / newQty;
        await prisma.position.update({ where: { id: existing.id }, data: { quantity: newQty, avgPrice: newAvg, name } });
      } else {
        await prisma.position.create({ data: { userId: user.id, symbol, name, quantity: qtyInt, avgPrice: price } });
      }
      await prisma.user.update({ where: { id: user.id }, data: { cash: user.cash - cost } });
      await prisma.order.create({ data: { userId: user.id, symbol, side, qty: qtyInt, price } });
    } else if (side === "SELL") {
      const existing = await prisma.position.findUnique({ where: { userId_symbol: { userId: user.id, symbol } } });
      if (!existing || existing.quantity < qtyInt) return res.status(400).send("Position insuffisante");
      const proceeds = price * qtyInt;
      const remaining = existing.quantity - qtyInt;
      if (remaining === 0) {
        await prisma.position.delete({ where: { id: existing.id } });
      } else {
        await prisma.position.update({ where: { id: existing.id }, data: { quantity: remaining } });
      }
      await prisma.user.update({ where: { id: user.id }, data: { cash: user.cash + proceeds } });
      await prisma.order.create({ data: { userId: user.id, symbol, side, qty: qtyInt, price } });
    } else {
      return res.status(400).send("Side invalide");
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send("Échec ordre");
  }
}
