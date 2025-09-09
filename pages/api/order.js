import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// Limite anti-spam : 10 ordres / minute / utilisateur
const MAX_ORDERS = 10;
const WINDOW_MS = 60_000;

export default async function handler(req, res) {
  // Auth obligatoire
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const email = session.user.email;

  // Rate limiting (en mémoire par instance)
  try {
    global._rate = global._rate || new Map();
    const now = Date.now();
    const history = global._rate.get(email) || [];
    const recent = history.filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_ORDERS) {
      res.status(429).json({ error: "Trop d'ordres. Réessaie dans une minute." });
      return;
    }
    recent.push(now);
    global._rate.set(email, recent);
  } catch {
    // ignore
  }

  try {
    // 1) Validation payload
    const { symbol, side, quantity } = req.body || {};

    if (typeof symbol !== "string" || !symbol.trim()) {
      res.status(400).json({ error: "Symbole invalide" });
      return;
    }
    const SIDE = String(side || "").toUpperCase();
    if (!["BUY", "SELL"].includes(SIDE)) {
      res.status(400).json({ error: "Côté invalide (BUY ou SELL)" });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ error: "Quantité invalide (> 0)" });
      return;
    }

    // 2) Récupérer l'utilisateur
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    // 3) Récupérer le prix courant via l'endpoint interne /api/quote/:symbol
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;
    const rq = await fetch(`${base}/api/quote/${encodeURIComponent(symbol)}`);
    if (!rq.ok) {
      res.status(502).json({ error: "Prix indisponible (quote API)" });
      return;
    }
    const q = await rq.json();
    const price = Number(q?.price);
    if (!Number.isFinite(price) || price <= 0) {
      res.status(502).json({ error: "Prix invalide renvoyé par l’API quote" });
      return;
    }

    // 4) Créer l'ordre
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        symbol: symbol.trim().toUpperCase(),
        side: SIDE,         // enum Side (BUY/SELL)
        quantity: qty,
        price: price,
      },
      select: { id: true, createdAt: true, symbol: true, side: true, quantity: true, price: true },
    });

    res.json(order);
    return;
  } catch (e) {
    console.error("/api/order error:", e);
    const msg = String(e?.message || "Erreur interne");
    if (msg.includes("Unknown arg") || msg.includes("Argument")) {
      res.status(500).json({ error: "Schéma Prisma non aligné avec le code (Order)." });
      return;
    }
    res.status(500).json({ error: "Erreur interne" });
  }
}