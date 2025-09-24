// pages/api/stripe/webhook.js
import { stripe } from "../../../lib/stripe";
import { buffer } from "micro";

export const config = {
  api: {
    bodyParser: false, // nécessaire pour vérifier la signature Stripe
  },
};

const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // whsec_xxx

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Méthode non supportée");
  if (!stripe || !WH_SECRET) return res.status(500).send("Stripe webhook non configuré");

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, WH_SECRET);
  } catch (err) {
    console.error("[stripe][webhook] signature invalide:", err?.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // TODO: lier session.customer_email à ton user → activer EDB Plus dans ta DB
        console.log("[stripe] checkout.session.completed:", {
          id: session.id,
          email: session.customer_details?.email,
          subscription: session.subscription,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        // TODO: mettre à jour l'état d'abonnement en DB si tu crées un modèle
        console.log(`[stripe] ${event.type}:`, { id: sub.id, status: sub.status });
        break;
      }
      default:
        // autres events
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("[stripe][webhook] handler fatal:", e);
    return res.status(500).send("Webhook handler error");
  }
}