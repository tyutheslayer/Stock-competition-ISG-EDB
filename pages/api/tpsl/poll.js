// pages/api/tpsl/poll.js
// Le client appelle cette route toutes les 5-10s. Elle:
// - charge les règles armées de l'utilisateur
// - récupère les derniers prix EUR
// - déclenche les fermetures via /api/close-plus
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

async function fetchQuoteEUR(req, symbol) {
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const url = `${proto}://${host}/api/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("quote HTTP " + r.status);
  const j = await r.json();
  const px = Number(j?.priceEUR ?? j?.price ?? NaN);
  if (!Number.isFinite(px)) throw new Error("quote invalid");
  return px;
}

async function closeByPositionSymbol(req, userId, positionSym, qty) {
  // retrouver l'ID de position
  const pos = await prisma.position.findFirst({
    where: { userId, symbol: positionSym },
    select: { id: true, quantity: true }
  });
  if (!pos) return { ok:false, error:"POSITION_NOT_FOUND" };

  const quantity = Math.min(qty ?? pos.quantity, pos.quantity);
  // appeler l'endpoint existant pour centraliser la logique
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const url = `${proto}://${host}/api/close-plus`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ positionId: pos.id, quantity })
  });
  const j = await r.json().catch(()=> ({}));
  return r.ok ? { ok:true, ...j } : { ok:false, error: j?.error || "CLOSE_FAILED" };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });
    const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id:true }});
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    const rules = await prisma.tpslRule.findMany({
      where: { userId: me.id, isArmed: true },
      orderBy: { createdAt: "asc" }
    });
    if (!rules.length) return res.status(200).json({ ok:true, triggers: [] });

    // prix par baseSymbol
    const bases = [...new Set(rules.map(r => r.baseSymbol))];
    const prices = {};
    for (const s of bases) {
      try { prices[s] = await fetchQuoteEUR(req, s); } catch {}
    }

    const triggers = [];
    for (const r of rules) {
      const px = Number(prices[r.baseSymbol] ?? NaN);
      if (!Number.isFinite(px)) continue;

      const side = String(r.side).toUpperCase(); // LONG | SHORT
      let hit = null;       // "TP" | "SL"
      if (side === "LONG") {
        if (r.tp != null && px >= r.tp) hit = "TP";
        if (!hit && r.sl != null && px <= r.sl) hit = "SL";
      } else {
        if (r.tp != null && px <= r.tp) hit = "TP";
        if (!hit && r.sl != null && px >= r.sl) hit = "SL";
      }
      if (!hit) continue;

      // fermer
      const qty = r.qtyMode === "PART" && Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : undefined;
      const result = await closeByPositionSymbol(req, me.id, r.positionSym, qty);
      if (!result.ok) continue;

      // armer -> false + log
      await prisma.$transaction([
        prisma.tpslRule.update({ where: { id: r.id }, data: { isArmed: false } }),
        prisma.tpslTrigger.create({
          data: {
            ruleId: r.id,
            userId: me.id,
            positionSym: r.positionSym,
            priceEUR: px,
            reason: hit,
            closedQty: result.closedQty ?? qty ?? 0
          }
        })
      ]);

      triggers.push({ ruleId: r.id, positionSym: r.positionSym, hit, price: px, closedQty: result.closedQty ?? qty ?? 0 });
    }

    return res.status(200).json({ ok:true, triggers });
  } catch (e) {
    console.error("[tpsl/poll] fatal:", e);
    return res.status(500).json({ error: "TPSL_POLL_FAILED" });
  }
}