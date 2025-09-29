// pages/api/sumup/verify.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import { getCheckout } from "../../../lib/sumup";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const sub = await prisma.plusSubscription.findUnique({ where: { userId: user.id } });
    if (!sub?.checkoutId) return res.status(400).json({ error: "NO_CHECKOUT" });

    const ck = await getCheckout(sub.checkoutId);
    const status = (ck?.status || "").toUpperCase();

    if (status === "PAID") {
      await prisma.plusSubscription.update({
        where: { userId: user.id },
        data: { status: "active", activatedAt: new Date() },
      });
      return res.json({ ok: true, status: "active" });
    }
    if (status === "PENDING") return res.json({ ok: false, status: "pending" });

    await prisma.plusSubscription.update({
      where: { userId: user.id },
      data: { status: "canceled" },
    });
    return res.json({ ok: false, status: status.toLowerCase() });
  } catch (e) {
    console.error("[sumup][verify]", e);
    return res.status(500).json({ error: "VERIFY_FAILED", detail: e?.message || String(e) });
  }
}