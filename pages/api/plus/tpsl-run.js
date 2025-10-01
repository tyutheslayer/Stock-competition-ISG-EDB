// pages/api/plus/tpsl-run.js
import { getSettings } from "../../../lib/settings";
import prisma from "../../../lib/prisma";

/* Utilitaires */
function parseExtSymbol(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase(); // LONG|SHORT
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  return { base, kind: "SPOT" };
}

async function fetchQuoteEUR(host, proto, symbol) {
  const url = `${proto}://${host}/api/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Quote ${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const px = Number(j?.priceEUR ?? j?.price ?? NaN);
  if (!Number.isFinite(px)) throw new Error(`Quote ${symbol} invalid`);
  return px;
}

async function closePosition(host, proto, userId, positionSym, wantedQty /* undefined = all */) {
  // Retrouver la position par (userId, symbol)
  const pos = await prisma.position.findFirst({
    where: { userId, symbol: positionSym },
  });
  if (!pos) return { ok: false, error: "POSITION_NOT_FOUND" };

  const qty = wantedQty == null ? pos.quantity : Math.min(Number(wantedQty), pos.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "QTY_INVALID" };

  // Appelle l’endpoint existant pour centraliser les calculs/écritures
  const url = `${proto}://${host}/api/close-plus`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ positionId: String(pos.id), quantity: qty }),
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) return { ok: false, error: j?.error || "CLOSE_FAILED" };
  return { ok: true, result: j };
}

export default async function handler(req, res) {
  // Pas besoin d’auth ici: endpoint réservé au cron (à protéger par secret si tu veux)
  try {
    const method = (req.method || "GET").toUpperCase();
    if (!["GET", "POST"].includes(method)) return res.status(405).json({ error: "Method not allowed" });

    const host  = req.headers.host;
    const proto = (req.headers["x-forwarded-proto"] || "https");

    // 1) Règles armées
    const rules = await prisma.tpslRule.findMany({
      where: { isArmed: true },
      orderBy: { createdAt: "asc" },
    });
    if (!rules.length) return res.status(200).json({ ok: true, processed: 0 });

    // 2) Quotes groupées par baseSymbol
    const bases = [...new Set(rules.map(r => r.baseSymbol))];
    const quotes = {};
    for (const b of bases) {
      try { quotes[b] = await fetchQuoteEUR(host, proto, b); } catch {}
    }

    let fired = 0;

    // 3) Boucle : test et close
    for (const rule of rules) {
      const m = parseExtSymbol(rule.positionSym);
      if (m.kind !== "LEV") continue; // (par sécurité)

      const last = quotes[m.base];
      if (!Number.isFinite(last)) continue;

      // conditions
      let hit = null;
      if (m.side === "LONG") {
        if (rule.tp != null && last >= rule.tp) hit = "TP";
        if (!hit && rule.sl != null && last <= rule.sl) hit = "SL";
      } else {
        // SHORT : TP quand le prix DESCEND sous tp ; SL quand ça remonte au-dessus de sl
        if (rule.tp != null && last <= rule.tp) hit = "TP";
        if (!hit && rule.sl != null && last >= rule.sl) hit = "SL";
      }

      if (!hit) continue;

      // 4) Fermer via API
      const qtyWanted = rule.qtyMode === "QTY" ? rule.quantity : undefined;
      const { ok, error, result } = await closePosition(host, proto, rule.userId, rule.positionSym, qtyWanted);
      if (!ok) {
        console.warn("[tpsl-run] close failed", { ruleId: rule.id, error });
        continue;
      }

      fired++;

      // 5) Log
      await prisma.tpslTrigger.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          positionSym: rule.positionSym,
          priceEUR: Number(last),
          reason: hit,
          closedQty: Number(result?.closedQty || qtyWanted || 0),
        },
      });

      // 6) Si ALL et position fermée: désarmer (sinon : laisser armé)
      // On re-check la position restante
      const still = await prisma.position.findFirst({
        where: { userId: rule.userId, symbol: rule.positionSym },
      });
      if (!still || still.quantity <= 0 || rule.qtyMode === "ALL") {
        await prisma.tpslRule.update({ where: { id: rule.id }, data: { isArmed: false } });
      }
    }

    return res.status(200).json({ ok: true, processed: rules.length, triggered: fired });
  } catch (e) {
    console.error("[/api/plus/tpsl-run] fatal:", e);
    return res.status(500).json({ error: "TPSL_RUN_FAILED", detail: String(e?.message || e) });
  }
}