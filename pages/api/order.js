// pages/api/order.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
    if (req.method !== "POST") return res.status(405).end();

    const { symbol, side, quantity } = req.body || {};
    const SIDE = String(side || "").toUpperCase();
    const qty = Number(quantity);

    if (typeof symbol !== "string" || !symbol.trim()) {
      return res.status(400).json({ error: "Symbole invalide" });
    }
    if (!["BUY", "SELL"].includes(SIDE)) {
      return res.status(400).json({ error: "Côté invalide (BUY ou SELL)" });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantité invalide (> 0)" });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    // Prix via l’API interne (comme au tout début)
    const base = `https://${req.headers.host}`;
    const rq = await fetch(`${base}/api/quote/${encodeURIComponent(symbol)}`);
    if (!rq.ok) {
      return res.status(502).json({ error: "Prix indisponible (quote API)" });
    }
    const q = await rq.json();
    const price = Number(q?.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(502).json({ error: "Prix invalide renvoyé par l’API quote" });
    }

    // Création de l’ordre
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        symbol: symbol.trim().toUpperCase(),
        side: SIDE,          // enum Side (BUY/SELL)
        quantity: qty,
        price
      },
      select: { id: true, createdAt: true, symbol: true, side: true, quantity: true, price: true }
    });

    return res.json(order);
  } catch (e) {
    console.error("/api/order error:", e);
    return res.status(500).json({ error: "Erreur interne" });
  }
}