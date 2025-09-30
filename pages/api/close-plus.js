// pages/api/close-plus.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import { getSettings } from "../../lib/settings";

// Parse "AAPL::LEV:LONG:10x" ou "AIR.PA::OPT:PUT"
function parseExtSymbol(ext) {
  const [base, tag, side, levX] = String(ext || "").split("::").slice(0).join("::").split("::"); // sécurise
  if (!tag) return { base: ext, kind: "SPOT" };
  const parts = ext.split("::");
  const baseSymbol = parts[0];

  if (parts[1] === "LEV") {
    const s = parts[2]; // LONG|SHORT
    const l = parts[3] || "1x";
    const lev = Math.max(1, Math.min(50, Number(String(l).replace(/x$/i, "")) || 1));
    return { base: baseSymbol, kind: "LEV", side: s, lev };
  }
  if (parts[1] === "OPT") {
    const s = parts[2]; // CALL|PUT
    return { base: baseSymbol, kind: "OPT", side: s, lev: 1 };
  }
  return { base: baseSymbol, kind: "SPOT" };
}

async function fetchQuoteEUR(req, symbol) {
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const url = `${proto}://${host}/api/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Quote fetch failed ${r.status}`);
  const j = await r.json();
  const price = Number(j?.priceEUR ?? NaN);
  if (!Number.isFinite(price)) throw new Error("Prix EUR indisponible");
  return { priceEUR: price };
}

export default async function handler(req, res) {
  try {
    // Accepte POST (normal) et DELETE (fallback). Refuse le reste.
    const method = (req.method || "GET").toUpperCase();
    if (method !== "POST" && method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    // Récup params (body JSON OU query-string fallback)
    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    } catch { body = {}; }

    const positionId = body.positionId ?? req.query.positionId ?? null;
    const quantity   = body.quantity   ?? req.query.quantity   ?? undefined;

    if (!positionId) return res.status(400).json({ error: "POSITION_ID_REQUIRED" });

    const pos = await prisma.position.findUnique({
      where: { id: positionId },
    });
    if (!pos || pos.userId !== me.id) return res.status(404).json({ error: "POSITION_NOT_FOUND" });

    const qtyClose = Math.max(1, Math.min(Number(quantity || pos.quantity), pos.quantity || 0));
    if (!Number.isFinite(qtyClose) || qtyClose <= 0) return res.status(400).json({ error: "QUANTITY_INVALID" });

    const meta = parseExtSymbol(pos.symbol);
    if (meta.kind === "SPOT") {
      return res.status(400).json({ error: "NOT_A_PLUS_POSITION" });
    }

    // Prix courant
    const { priceEUR } = await fetchQuoteEUR(req, meta.base);

    const { tradingFeeBps = 0 } = await getSettings().catch(() => ({ tradingFeeBps: 0 }));
    const feeRate = Math.max(0, Number(tradingFeeBps) || 0) / 10000;

    // Calculs
    let creditEUR = 0;
    let pnl = 0;
    let feeEUR = 0;

    if (meta.kind === "LEV") {
      // PnL = (price - avg) * qty pour LONG ; inverse pour SHORT
      const diff = (meta.side === "LONG")
        ? (priceEUR - pos.avgPrice)
        : (pos.avgPrice - priceEUR);
      pnl = diff * qtyClose;

      // Marge initiale sur la partie fermée: avgPrice * qtyClose / lev
      const marginPart = (pos.avgPrice * qtyClose) / (meta.lev || 1);

      const notionalClose = priceEUR * qtyClose;
      feeEUR = notionalClose * feeRate;

      creditEUR = Math.max(0, marginPart + pnl - feeEUR);
      // (si pertes > marge, crédit clampé à 0 — la liquidation “auto” viendra plus tard)

    } else if (meta.kind === "OPT") {
      // Payout intrinsèque au close (acheteur d’option) :
      // CALL: max(0, price - strike) ; PUT: max(0, strike - price)
      // Ici strike ~ avgPrice d’entrée (on avait stocké avgPrice = spot à l’ouverture)
      const intrinsic = (meta.side === "CALL")
        ? Math.max(0, priceEUR - pos.avgPrice) * qtyClose
        : Math.max(0, pos.avgPrice - priceEUR) * qtyClose;

      feeEUR = intrinsic * feeRate; // simple : frais sur le payout
      creditEUR = Math.max(0, intrinsic - feeEUR);
      // NB: la prime payée à l’ouverture n’est pas remboursée (logique acheteur d’option)
      pnl = intrinsic; // “payout reçu” (ton P&L net global = payout - prime payée à l’open)

    } else {
      return res.status(400).json({ error: "UNKNOWN_PLUS_KIND" });
    }

    // Écritures atomiques : créditer user.cash + réduire/supprimer la position + log ordre
    const tx = await prisma.$transaction(async (trx) => {
      if (creditEUR > 0) {
        await trx.user.update({
          where: { id: me.id },
          data: { cash: { increment: creditEUR } },
        });
      }

      const remaining = Number(pos.quantity) - qtyClose;
      let newPos = null;
      if (remaining > 0) {
        newPos = await trx.position.update({
          where: { id: pos.id },
          data: { quantity: remaining },
        });
      } else {
        await trx.position.delete({ where: { id: pos.id } });
      }

      const order = await trx.order.create({
        data: {
          userId: me.id,
          symbol: pos.symbol,
          side: `CLOSE:${meta.kind}:${meta.side}:${meta.lev || 1}x`,
          quantity: qtyClose,
          price: priceEUR,
          feeEUR,
        },
      });

      return { newPos, orderId: order.id };
    });

    return res.status(200).json({
      ok: true,
      positionId,
      closedQty: qtyClose,
      priceEUR,
      feeBps: tradingFeeBps,
      feeEUR,
      pnlEUR: pnl,
      cashCreditedEUR: creditEUR,
      orderId: tx.orderId,
    });

  } catch (e) {
    console.error("[/api/close-plus] fatal:", e);
    return res.status(500).json({ error: "CLOSE_PLUS_FAILED", detail: String(e?.message || e) });
  }
}