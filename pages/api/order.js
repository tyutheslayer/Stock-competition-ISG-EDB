// pages/api/order.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// Limite anti-spam : 10 ordres / minute / utilisateur
const MAX_ORDERS = 10;
const WINDOW_MS = 60_000;

export default async function handler(req, res) {
  // Auth
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const email = session.user.email;

  // Anti-spam en mémoire
  try {
    global._rate = global._rate || new Map();
    const now = Date.now();
    const history = global._rate.get(email) || [];
    const recent = history.filter(t => now - t < WINDOW_MS);
    if (recent.length >= MAX_ORDERS) {
      return res.status(429).json({ error: "Trop d'ordres. Réessaie dans une minute." });
    }
    recent.push(now);
    global._rate.set(email, recent);
  } catch {}

  try {
    // Validation
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

    // Utilisateur
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    // Prix via l’API interne /api/quote/:symbol (comme avant)
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const base = `${proto}://${host}`;
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
        side: SIDE,         // enum Side
        quantity: qty,
        price
      },
      select: { id: true, createdAt: true, symbol: true, side: true, quantity: true, price: true }
    });

    return res.json(order);
  } catch (e) {
    console.error("/api/order error:", e);
    const msg = String(e?.message || "");
    if (msg.includes("Unknown arg") || msg.includes("Argument")) {
      return res.status(500).json({ error: "Schéma Prisma non aligné avec le code (Order)." });
    }
    return res.status(500).json({ error: "Erreur interne" });
  }
}