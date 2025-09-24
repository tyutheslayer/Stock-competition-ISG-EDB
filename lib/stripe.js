// lib/stripe.js
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
  // On ne jette pas d'erreur au build, mais on informera côté API si absent.
  console.warn("[stripe] STRIPE_SECRET_KEY manquant (set dans les variables d'env).");
}

export const stripe =
  secret
    ? new Stripe(secret, {
        apiVersion: "2024-06-20",
      })
    : null;