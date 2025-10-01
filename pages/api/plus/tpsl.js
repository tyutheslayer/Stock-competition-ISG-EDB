// pages/api/plus/tpsl.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

function parseExtSymbol(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase(); // LONG|SHORT
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  if (parts[1] === "OPT") {
    const side = (parts[2] || "").toUpperCase();
    return { base, kind: "OPT", side, lev: 1 };
  }
  return { base, kind: "SPOT" };
}

export default async function handler(req, res) {
  try {
    const method = (req.method || "GET").toUpperCase();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    // On récupère l'user pour l'id
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    if (method === "GET") {
      // Liste des règles actives (ou toutes si ?all=1)
      const all = String(req.query.all || "0") === "1";
      const rows = await prisma.tpslRule.findMany({
        where: { userId: me.id, ...(all ? {} : { isArmed: true }) },
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json(rows);
    }

    if (method === "DELETE") {
      // ?id=xxx  -> désarme/supprime
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "ID_REQUIRED" });
      await prisma.tpslRule.update({
        where: { id },
        data: { isArmed: false },
      }).catch(async () => {
        // si déjà supprimée, on ignore
      });
      return res.status(200).json({ ok: true });
    }

    // Parse body
    let body = {};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch {}
    const { positionSymbol, quantity, qtyMode, tp, sl, isArmed } = body;

    if (!positionSymbol || typeof positionSymbol !== "string") {
      return res.status(400).json({ error: "POSITION_SYMBOL_REQUIRED" });
    }

    const meta = parseExtSymbol(positionSymbol);
    if (meta.kind !== "LEV") {
      return res.status(400).json({ error: "ONLY_LEVERAGED_SUPPORTED_FOR_NOW" });
    }

    const payload = {
      userId: me.id,
      positionSym: positionSymbol,
      baseSymbol: meta.base,
      kind: "LEV",
      side: meta.side,
      quantity: (qtyMode === "QTY" ? Number(quantity) : null),
      qtyMode: (qtyMode === "QTY" ? "QTY" : "ALL"),
      tp: (tp == null || tp === "") ? null : Number(tp),
      sl: (sl == null || sl === "") ? null : Number(sl),
      isArmed: (isArmed === false ? false : true),
    };

    if (["POST", "PUT"].includes(method)) {
      // Upsert par (userId + positionSym)
      const rule = await prisma.tpslRule.upsert({
        where: { id: String(body.id || "") || "___nope___" }, // si id fourni -> update
        update: payload,
        create: payload,
      }).catch(async () => {
        // si pas d'id fourni, on peut chercher une règle existante pour cette position
        const existing = await prisma.tpslRule.findFirst({
          where: { userId: me.id, positionSym: positionSymbol, isArmed: true },
        });
        if (existing) {
          return prisma.tpslRule.update({ where: { id: existing.id }, data: payload });
        }
        return prisma.tpslRule.create({ data: payload });
      });

      return res.status(200).json({ ok: true, rule });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/plus/tpsl] fatal:", e);
    return res.status(500).json({ error: "TPSL_FAILED", detail: String(e?.message || e) });
  }
}