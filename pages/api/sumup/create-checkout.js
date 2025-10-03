// pages/api/sumup/create-checkout.js

export default async function handler(req, res) {
  // refuse toute méthode sauf POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  // réponse fixe : paiement désactivé
  return res.status(501).json({
    error: "PAYMENT_DISABLED",
    message:
      "Le paiement en ligne est désactivé. Merci de régler directement auprès du Président de l’association.",
  });
}