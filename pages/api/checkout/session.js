// pages/api/checkout/session.js
import { stripe } from "../../../lib/stripe";
// (Optionnel) si tu veux préremplir l'email quand l'utilisateur est connecté :
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const PRICE_ID = process.env.STRIPE_PRICE_ID; // price_xxx (abonnement à 20€)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe non configuré (clé secrète manquante)" });
    }
    if (!PRICE_ID) {
      return res.status(500).json({ error: "STRIPE_PRICE_ID manquant" });
    }

    // (Optionnel — si tu veux pousser l'email du user connecté)
       let customerEmail = undefined;
       try {
         const session = await getServerSession(req, res, authOptions);
         customerEmail = session?.user?.email || undefined;
       } catch {}

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",                // Abonnement mensuel
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: customerEmail,     // décommente si tu veux préremplir quand connecté
      success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/plus`,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      metadata: {
        plan: "EDB_PLUS",
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("[/api/checkout/session] fatal:", e);
    return res.status(500).json({ error: "Impossible de créer la session Stripe" });
  }
}