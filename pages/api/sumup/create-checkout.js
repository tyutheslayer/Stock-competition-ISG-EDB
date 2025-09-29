// pages/api/sumup/create-checkout.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import { createCheckout } from "../../../lib/sumup";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const amount = Number(process.env.PLUS_PRICE_EUR || 20);
    const product = process.env.PLUS_PRODUCT_NAME || "EDB Plus";
    const reference = `EDBPLUS:${user.id}:${Date.now()}`;
    const returnUrl = "https://edb-project.org/plus?paid=1";

    const ck = await createCheckout({
      amount,
      currency: "EUR",
      description: `${product} – Abonnement mensuel [${reference}]`,
      reference,
      returnUrl,
    });

    // Mémorise la tentative
    await prisma.plusSubscription.upsert({
      where: { userId: user.id },
      update: { checkoutId: ck?.id || null, status: "pending" },
      create: { userId: user.id, checkoutId: ck?.id || null, status: "pending" },
    });

    if (ck?.checkout_url) return res.json({ ok: true, url: ck.checkout_url });
    return res.json({ ok: true, raw: ck });
  } catch (e) {
    console.error("[sumup][create-checkout]", e);
    return res.status(400).json({
      error: "CREATE_CHECKOUT_FAILED",
      detail: e?.detail || e?.message || String(e),
      hint: e?.hint,
    });
  }
}