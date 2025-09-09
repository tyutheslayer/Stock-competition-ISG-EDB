import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";

// Limite anti-spam : 10 ordres / minute / utilisateur
const MAX_ORDERS = 10;
const WINDOW_MS = 60_000;

// --- FONCTIONS PRIX (Yahoo -> Stooq -> dev) ---
async function priceFromYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (StockCompBot/1.0)" } });
  if (!r.ok) throw new Error("yahoo_http");
  const j = await r.json();
  const q = j?.quoteResponse?.result?.[0];
  if (!q) throw new Error("yahoo_empty");
  const price =
    (typeof q.regularMarketPrice === "number" && q.regularMarketPrice) ||
    (typeof q.postMarketPrice === "number" && q.postMarketPrice) ||
    (typeof q.preMarketPrice === "number" && q.preMarketPrice) ||
    (typeof q.ask === "number" && q.ask) ||
    (typeof q.bid === "number" && q.bid) ||
    (typeof q.previousClose === "number" && q.previousClose) ||
    null;
  if (!Number.isFinite(price) || price <= 0) throw new Error("yahoo_price");
  return { price: Number(price), currency: q.currency || "USD", name: q.shortName || q.longName || symbol };
}
async function priceFromStooq(symbol) {
  const s = String(symbol).toLowerCase().trim();
  const candidates = [s];
  if (!s.includes(".")) candidates.push(`${s}.us`, `${s}.pa`, `${s}.de`);
  for (const c of candidates) {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(c)}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(url, { headers: { "User-Agent": "StockCompBot/1.0" } });
    if (!r.ok) continue;
    const csv = await r.text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const headers = lines[0].split(",");
    const values = lines[1].split(",");
    const idxClose = headers.findIndex(h => /close/i.test(h));
    if (idxClose === -1) continue;
    const close = Number(values[idxClose]);
    if (!Number.isFinite(close) || close <= 0) continue;
    return { price: close, currency: "USD", name: symbol };
  }
  throw new Error("stooq_fail");
}
async function resolvePrice(symbol) {
  const s = String(symbol || "").trim().toUpperCase();
  if (!s) throw new Error("symbol_invalid");
  try { return await priceFromYahoo(s); } catch {}
  try { return await priceFromStooq(s); } catch {}
  if (process.env.NEXT_PUBLIC_DEBUG === "1") return { price: 100, currency: "USD", name: s };
  throw new Error("price_unavailable_all_sources");
}

export default async function handler(req, res) {
  // Auth
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const email = session.user.email;

  // Rate limit (mémoire)
  try {
    global._rate = global._rate || new Map();
    const now = Date.now();
    const history = global._rate.get(email) || [];
    const recent = history.filter(t => now - t < WINDOW_MS);
    if (recent.length >= MAX_ORDERS) { res.status(429).json({ error: "Trop d'ordres. Réessaie dans une minute." }); return; }
    recent.push(now);
    global._rate.set(email, recent);
  } catch {}

  try {
    // Validation
    const { symbol, side, quantity } = req.body || {};
    const SIDE = String(side || "").toUpperCase();
    const qty = Number(quantity);
    if (typeof symbol !== "string" || !symbol.trim()) { res.status(400).json({ error: "Symbole invalide" }); return; }
    if (!["BUY","SELL"].includes(SIDE)) { res.status(400).json({ error: "Côté invalide (BUY ou SELL)" }); return; }
    if (!Number.isFinite(qty) || qty <= 0) { res.status(400).json({ error: "Quantité invalide (> 0)" }); return; }

    // User
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

    // Prix (sans appel interne)
    const { price } = await resolvePrice(symbol);

    // Création de l’ordre (logiciel simple; la gestion cash/positions viendra ensuite)
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        symbol: symbol.trim().toUpperCase(),
        side: SIDE,
        quantity: qty,
        price
      },
      select: { id: true, createdAt: true, symbol: true, side: true, quantity: true, price: true }
    });

    res.json(order);
    return;
  } catch (e) {
    console.error("/api/order error:", e);
    const msg = String(e?.message || "Erreur interne");
    if (process.env.NEXT_PUBLIC_DEBUG === "1") { res.status(500).json({ error: "Erreur interne", detail: msg }); return; }
    if (msg.includes("Unknown arg") || msg.includes("Argument")) { res.status(500).json({ error: "Schéma Prisma non aligné avec le code (Order)." }); return; }
    res.status(500).json({ error: "Erreur interne" });
  }
}