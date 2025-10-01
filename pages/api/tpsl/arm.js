// pages/api/tpsl/arm.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true }});
    if (!me) return res.status(401).json({ error: "Unauthenticated" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const {
      baseSymbol,            // ex: "AAPL"
      positionSym,          // ex: "AAPL::LEV:LONG:10x"
      side,                 // "LONG" | "SHORT"
      lev = 1,
      quantity = null,      // null => ALL
      tp = null,            // prix EUR
      sl = null,            // prix EUR
    } = body;

    if (!baseSymbol || !positionSym || !side) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }
    if (tp == null && sl == null) {
      return res.status(400).json({ error: "NEED_TP_OR_SL" });
    }

    const rule = await prisma.tpslRule.create({
      data: {
        userId: me.id,
        baseSymbol: String(baseSymbol).toUpperCase(),
        positionSym: String(positionSym),
        kind: "LEV",
        side: String(side).toUpperCase(),
        qtyMode: quantity ? "PART" : "ALL",
        quantity: quantity ?? null,
        tp: tp ?? null,
        sl: sl ?? null,
        isArmed: true,
      }
    });

    return res.status(200).json({ ok: true, ruleId: rule.id });
  } catch (e) {
    console.error("[tpsl/arm] fatal:", e);
    return res.status(500).json({ error: "TPSL_ARM_FAILED" });
  }
}