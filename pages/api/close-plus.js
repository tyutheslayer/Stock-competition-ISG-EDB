// pages/api/close-plus.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "../../lib/prisma";
import { getSettings } from "../../lib/settings";

// Parse "AAPL::LEV:LONG:10x" ou "AIR.PA::OPT:PUT"
function parseExtSymbol(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts.length < 2) return { base, kind: "SPOT" };
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase(); // LONG|SHORT
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  if (parts[1] === "OPT") {
    const side = (parts[2] || "").toUpperCase(); // CALL|PUT
    return { base, kind: "OPT", side, lev: 1 };
  }
  return { base, kind: "SPOT" };
}

async function fetchQuoteEUR(req, symbol) {
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const url = `${proto}://${host}/api/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Quote fetch failed ${r.status}`);
  const j = await r.json();
  const price = Number(j?.priceEUR ?? j?.price ?? NaN);
  if (!Number.isFinite(price)) throw new Error("Prix EUR indisponible");
  return { priceEUR: price };
}

// Tolère id numérique OU string (UUID/BigInt string…)
async function loadPositionByIdAnyType(userId, raw) {
  // 1) essai Number
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    try {
      const pos = await prisma.position.findUnique({ where: { id: asNum } });
      if (pos && pos.userId === userId) return pos;
    } catch {}
  }
  // 2) essai string (si le schéma est String/UUID)
  try {
    const pos = await prisma.position.findUnique({ where: { id: String(raw) } });
    if (pos && pos.userId === userId) return pos;
  } catch {}
  return null;
}

export default async function handler(req, res) {
  try {
    // On accepte POST (normal), DELETE et GET (fallback) pour éviter 405 côté client.
    const method = (req.method || "GET").toUpperCase();
    if (!["POST", "DELETE", "GET"].includes(method)) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    // lire params depuis body JSON OU query-string
    let body = {};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch {}
    // pages/api/close-plus.js (extrait au début du handler)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const rawId = body.positionId ?? body.id ?? body.posId ?? null;

    if (rawId == null || (typeof rawId !== "string" && typeof rawId !== "number")) {
      return res.status(400).json({ error: "POSITION_ID_REQUIRED" });
    }

    // 👇 Normalisation d’ID robuste (number si int, sinon string)
    let where;
    if (/^[0-9]+$/.test(String(rawId))) {
      // supposons Prisma Int
      where = { id: Number(rawId) };
    } else {
      // supposons Prisma String/UUID
      where = { id: String(rawId) };
    }

    const pos = await prisma.position.findUnique({ where });
    if (!pos || pos.userId !== me.id) {
      return res.status(404).json({ error: "POSITION_NOT_FOUND", got: rawId });
    }

    const qtyClose = Math.max(1, Math.min(Number(quantityRaw ?? pos.quantity), pos.quantity || 0));
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
      const diff = (meta.side === "LONG")
        ? (priceEUR - pos.avgPrice)
        : (pos.avgPrice - priceEUR);
      pnl = diff * qtyClose;

      const marginPart = (pos.avgPrice * qtyClose) / (meta.lev || 1);
      const notionalClose = priceEUR * qtyClose;
      feeEUR = notionalClose * feeRate;

      creditEUR = Math.max(0, marginPart + pnl - feeEUR);
    } else if (meta.kind === "OPT") {
      const intrinsic = (meta.side === "CALL")
        ? Math.max(0, priceEUR - pos.avgPrice) * qtyClose
        : Math.max(0, pos.avgPrice - priceEUR) * qtyClose;

      feeEUR = intrinsic * feeRate;             // frais simples sur le payout
      creditEUR = Math.max(0, intrinsic - feeEUR);
      pnl = intrinsic;                           // payout reçu
    } else {
      return res.status(400).json({ error: "UNKNOWN_PLUS_KIND" });
    }

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
      positionId: positionIdRaw,
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