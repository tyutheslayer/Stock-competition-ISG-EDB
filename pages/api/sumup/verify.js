// pages/api/sumup/verify.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import { getCheckout } from "../../../lib/sumup";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const sub = await prisma.plusSubscription.findUnique({ where: { userId: user.id } });
    if (!sub?.checkoutId) return res.status(400).json({ error: "NO_CHECKOUT" });

    const ck = await getCheckout(sub.checkoutId);
    // status possibles: PENDING|PAID|FAILED|CANCELLED (selon API)
    const status = (ck?.status || "").toUpperCase();

    if (status === "PAID") {
      await prisma.plusSubscription.update({
        where: { userId: user.id },
        data: { status: "active" },
      });
      return res.json({ ok: true, status: "active" });
    } else if (status === "PENDING") {
      return res.json({ ok: false, status: "pending" });
    } else {
      await prisma.plusSubscription.update({
        where: { userId: user.id },
        data: { status: "canceled" },
      });
      return res.json({ ok: false, status: status.toLowerCase() });
    }
  } catch (e) {
    console.error("[sumup][verify] ", e);
    return res.status(500).json({ error: "VERIFY_FAILED" });
  }
}