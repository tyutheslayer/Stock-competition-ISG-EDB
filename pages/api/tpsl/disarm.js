// pages/api/tpsl/disarm.js
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
    const { ruleId } = body;
    if (!ruleId) return res.status(400).json({ error: "RULE_ID_REQUIRED" });

    await prisma.tpslRule.updateMany({
      where: { id: ruleId, userId: me.id },
      data: { isArmed: false }
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[tpsl/disarm] fatal:", e);
    return res.status(500).json({ error: "TPSL_DISARM_FAILED" });
  }
}