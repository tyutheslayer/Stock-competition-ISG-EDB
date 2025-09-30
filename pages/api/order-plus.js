// pages/api/order-plus.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import { getSettings } from "../../lib/settings";

/**
 * Petit helper pour appeler /api/quote côté serveur
 */
async function fetchQuoteEUR(req, symbol) {
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const url = `${proto}://${host}/api/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Quote fetch failed ${r.status}`);
  const j = await r.json();
  const price = Number(j?.priceEUR ?? NaN);
  if (!Number.isFinite(price)) throw new Error("Prix EUR indisponible");
  return { priceEUR: price, name: j?.name || null };
}

function parseBody(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw || {});
  } catch {
    return {};
  }
}

/**
 * On encode les positions “Plus” dans la table Position existante en
 * utilisant un symbole étendu unique par user :
 *  - Levier LONG 10x sur AAPL => "AAPL::LEV:LONG:10x"
 *  - Levier SHORT 20x sur TSLA => "TSLA::LEV:SHORT:20x"
 *  - CALL sur MSFT => "MSFT::OPT:CALL"
 *  - PUT  sur AIR.PA => "AIR.PA::OPT:PUT"
 *
 * Ça respecte la contrainte @@unique([userId, symbol]) sans changer le schéma.
 */
function synthSymbol({ symbol, mode, side, leverage }) {
  if (mode === "LEVERAGED") {
    const lev = Math.max(1, Math.min(50, Number(leverage) || 1));
    return `${symbol}::LEV:${side}:${lev}x`;
  }
  if (mode === "OPTION") {
    return `${symbol}::OPT:${side}`;
  }
  return symbol;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, cash: true, role: true },
    });
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    // (Optionnel) autoriser les admins même si pas d’abo Plus
    // tu peux brancher ici un vrai check /api/plus/status si tu veux verrouiller.
    const isAdmin = me.role === "ADMIN";

    const body = parseBody(req.body);
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const mode = (body.type || body.mode || "").toUpperCase(); // "LEVERAGED" | "OPTION"
    const side = (body.side || "").toUpperCase();              // LONG|SHORT|CALL|PUT
    const qty  = Number(body.quantity || 0);
    const lev  = Math.max(1, Math.min(50, Number(body.leverage) || 1));

    if (!symbol) return res.status(400).json({ error: "SYMBOL_REQUIRED" });
    if (!["LEVERAGED", "OPTION"].includes(mode)) {
      return res.status(400).json({ error: "MODE_INVALID", hint: "type doit être LEVERAGED ou OPTION" });
    }
    if (
      (mode === "LEVERAGED" && !["LONG", "SHORT"].includes(side)) ||
      (mode === "OPTION"    && !["CALL", "PUT"].includes(side))
    ) {
      return res.status(400).json({ error: "SIDE_INVALID" });
    }
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "QUANTITY_INVALID" });

    // Récup prix
    const { priceEUR, name } = await fetchQuoteEUR(req, symbol);

    // Frais (bps)
    const { tradingFeeBps = 0 } = await getSettings().catch(() => ({ tradingFeeBps: 0 }));
    const feeRate = Math.max(0, Number(tradingFeeBps) || 0) / 10000;

    // Notional & frais
    const notional = priceEUR * qty; // base
    let cashNeeded = 0;
    let margin = 0;
    let premium = 0;

    if (mode === "LEVERAGED") {
      // Marge = notional / levier
      margin = notional / lev;
      const fee = notional * feeRate;
      cashNeeded = margin + fee;
      if (!Number.isFinite(cashNeeded)) return res.status(400).json({ error: "CALC_FAILED" });
    } else {
      // OPTION (simulation) : on prend une prime simple de 5% du notional
      premium = notional * 0.05; // règle simple, ajustable plus tard
      const fee = premium * feeRate;
      cashNeeded = premium + fee;
    }

    if (me.cash < cashNeeded && !isAdmin) {
      return res.status(400).json({ error: "INSUFFICIENT_CASH", need: cashNeeded, have: me.cash });
    }

    // Stockage dans Position (symbole étendu)
    const extSymbol = synthSymbol({ symbol, mode, side, leverage: lev });

    // On ouvre ou on augmente la position : avgPrice pondéré
    // (pour OPTIONS on place avgPrice = prix spot d’entrée; pour LEV on garde le prix spot comme référence)
    let position = await prisma.position.findUnique({
      where: { userId_symbol: { userId: me.id, symbol: extSymbol } },
    });

    const newQty = (Number(position?.quantity) || 0) + qty;
    const newAvg =
      position
        ? ((position.avgPrice * position.quantity) + (priceEUR * qty)) / (position.quantity + qty)
        : priceEUR;

    // Écritures atomiques
    const tx = await prisma.$transaction(async (trx) => {
      // 1) débiter la marge/premium + frais
      await trx.user.update({
        where: { id: me.id },
        data: { cash: { decrement: cashNeeded } },
      });

      // 2) upsert position plus
      const pos = await trx.position.upsert({
        where: { userId_symbol: { userId: me.id, symbol: extSymbol } },
        update: { quantity: newQty, avgPrice: newAvg, name: position?.name || (name ? `${name} • ${extSymbol}` : extSymbol) },
        create: {
          userId: me.id,
          symbol: extSymbol,
          name: name ? `${name} • ${extSymbol}` : extSymbol,
          quantity: qty,
          avgPrice: priceEUR,
        },
      });

      // 3) Log ordre
      const order = await trx.order.create({
        data: {
          userId: me.id,
          symbol: extSymbol,
          side: `${mode}:${side}:${lev}x`, // ex "LEVERAGED:LONG:10x" / "OPTION:CALL:1x"
          quantity: qty,
          price: priceEUR,
          feeEUR: cashNeeded - (mode === "LEVERAGED" ? margin : premium), // juste le montant des frais
        },
      });

      return { pos, order };
    });

    return res.status(200).json({
      ok: true,
      mode,
      side,
      leverage: lev,
      symbol,
      extSymbol,
      quantity: qty,
      entryPriceEUR: priceEUR,
      marginEUR: margin,
      premiumEUR: premium,
      cashDebitedEUR: cashNeeded,
      feeBps: tradingFeeBps,
      orderId: tx.order.id,
    });
  } catch (e) {
    console.error("[/api/order-plus] fatal:", e);
    return res.status(500).json({ error: "ORDER_PLUS_FAILED", detail: String(e?.message || e) });
  }
}