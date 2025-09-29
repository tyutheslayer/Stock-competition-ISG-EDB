// pages/api/sumup/create-checkout.js
import { createCheckout } from "../../../lib/sumup";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non supportée" });
  try {
    const { amount = 20, currency = "EUR", description = "EDB Plus — 1 mois" } = req.body || {};
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://edb-project.org";
    const checkout = await createCheckout({
      amount,
      currency,
      description,
      return_url: `${base}/plus?paid=1`,
    });
    return res.json(checkout);
  } catch (e) {
    console.error("[sumup][create-checkout] fail:", e);
    return res.status(500).json({ error: "CREATE_CHECKOUT_FAILED", detail: String(e?.message || e) });
  }
}