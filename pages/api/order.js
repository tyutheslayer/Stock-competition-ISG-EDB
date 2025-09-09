import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// Limite anti-spam : 10 ordres / minute / utilisateur
const MAX_ORDERS = 10;
const WINDOW_MS = 60_000;

export default async function handler(req, res) {
  // Auth obligatoire
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const email = session.user.email;

  // Rate limiting (en mémoire par instance)
  try {
    global._rate = global._rate || new Map();
    const now = Date.now();
    const history = global._rate.get(email) || [];
    const recent = history.filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_ORDERS) {
      return res.status(429).json({ error: "Trop d'ordres. Réessaie dans une minute." });
    }
    recent.push(now);
    global._rate.set(email, recent);
  } catch {}

  try {
    // 1) Validation payload
    const { symbol, side, quantity } = req.body || {};

    if (typeof symbol !== "string" || !symbol.trim()) {
      return res.status(400).json({ error: "Symbole invalide" });
    }
    const SIDE = String(side || "").toUpperCase();
    if (!["BUY", "SELL"].includes(SIDE)) {
      return res.status(400).json({ error: "Côté invalide (BUY ou SELL)" });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantité invalide (> 0)" });
    }

    // 2) Récupérer l'utilisateur
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    // 3) Récupérer le prix courant via l'endpoint interne /api/quote/:symbol
    const proto = req.headers["x-forwarded-proto"] || "http";
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

    // 4) Créer l'ordre (prix fixé au dernier prix, pas de cash/positions ici)
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

    return res.json(order);
  } catch (e) {
    console.error("/api/order error:", e);
    const msg = String(e?.message || "Erreur interne");
    if (msg.includes("Unknown arg") || msg.includes("Argument")) {
      return res.status(500).json({ error: "Schéma Prisma non aligné avec le code (Order)." });
    }
    return res.status(500).json({ error: "Erreur interne" });
  }
}

  try {
    // 1) Validation payload
    const { symbol, side, quantity } = req.body || {};

    if (typeof symbol !== "string" || !symbol.trim()) {
      return res.status(400).json({ error: "Symbole invalide" });
    }
    const SIDE = String(side || "").toUpperCase();
    if (!["BUY", "SELL"].includes(SIDE)) {
      return res.status(400).json({ error: "Côté invalide (BUY ou SELL)" });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantité invalide (> 0)" });
    }

    // 2) Vérifier l’utilisateur
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    // 3) Récupérer le prix courant via ton endpoint interne /api/quote/:symbol
    const proto = req.headers["x-forwarded-proto"] || "http";
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

    // 4) Créer l'ordre (on n'implémente pas la mise à jour cash/positions ici pour éviter les 500 liés au schéma)
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        symbol: symbol.trim().toUpperCase(),
        side: SIDE,                // Assure-toi que le type dans Prisma est bien texte / enum compatible
        quantity: qty,
        price: price               // champs non-null dans le schéma ?
      },
      select: { id: true, createdAt: true, symbol: true, side: true, quantity: true, price: true }
    });

    return res.json(order);
  } catch (e) {
    console.error("Erreur /api/order:", e);
    // Essayer de rendre l’erreur plus parlante si ça vient de Prisma (schema mismatch)
    if (String(e?.message || "").includes("Unknown arg") || String(e?.message || "").includes("Argument")) {
      return res.status(500).json({ error: "Schéma Prisma / champs Order non alignés. Vérifie que le modèle Order contient (userId, symbol, side, quantity, price, createdAt)." });
    }
    return res.status(500).json({ error: "Erreur interne" });
  }
}
