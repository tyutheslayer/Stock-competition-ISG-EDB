// pages/api/sumup/create-checkout.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import { createCheckout } from "../../../lib/sumup";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    // crée/assure un enregistrement d’abonnement (pending)
    const sub = await prisma.plusSubscription.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, status: "pending" },
    });

    const amount = Number(process.env.PLUS_PRICE_EUR || "20");
    const product = process.env.PLUS_PRODUCT_NAME || "EDB Plus";

    // référence pour tracer
    const checkoutRef = `EDBPLUS_${user.id}_${Date.now()}`;

    const redirectURL = `https://${req.headers.host}/plus/merci`;
    const ck = await createCheckout({
      amountEUR: amount,
      description: `${product} – ${user.email}`,
      redirectURL,
      checkoutRef,
    });

    await prisma.plusSubscription.update({
      where: { userId: user.id },
      data: { checkoutId: ck?.id || null },
    });

    return res.json({ id: ck.id, url: ck.checkout_url });
  } catch (e) {
    console.error("[sumup][create-checkout] ", e);
    return res.status(500).json({ error: "CREATE_FAILED" });
  }
}