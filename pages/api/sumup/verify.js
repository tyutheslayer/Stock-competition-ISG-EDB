import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import { findLatestMatchingTransaction } from "../../../lib/sumup";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const referenceLike = `EDBPLUS:${user.id}`; // on cherche une tx récente qui contient cette référence
    const tx = await findLatestMatchingTransaction({ reference: referenceLike, minAmount: Number(process.env.PLUS_PRICE_EUR || 20) });

    if (!tx) {
      return res.json({ ok: false, status: "pending_or_not_found" });
    }

    // À adapter selon la forme exacte de la transaction
    const status = (tx?.status || tx?.transaction_status || "").toLowerCase();
    const paid = ["paid", "successful", "success"].includes(status) || Number(tx?.amount || 0) >= Number(process.env.PLUS_PRICE_EUR || 20);

    if (paid) {
      await prisma.plusSubscription.upsert({
        where: { userId: user.id },
        update: { status: "active", activatedAt: new Date() },
        create: { userId: user.id, status: "active", activatedAt: new Date() },
      });
      return res.json({ ok: true, status: "active", tx });
    }

    return res.json({ ok: false, status, tx });
  } catch (e) {
    console.error("[sumup][verify] ", e);
    return res.status(500).json({ error: "VERIFY_FAILED", detail: e?.message || String(e) });
  }
}