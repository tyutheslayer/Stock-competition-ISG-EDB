// pages/api/settings.js
import { getSettings } from "../../lib/settings";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await getSettings();
      return res.status(200).json(data);
    }
    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[api/settings] fatal:", e);
    // Valeur par défaut pour ne pas casser l'UI
    return res.status(200).json({ tradingFeeBps: 0 });
  }
}