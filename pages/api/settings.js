// pages/api/settings.js

import { getSettings } from "../../lib/settings";

  export default async function handler(req, res) {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Méthode non supportée" });
      return;
    }
    try {
      const data = await getSettings();
      res.status(200).json(data);
    } catch (e) {
      console.error("[api/settings] fatal:", e);
      // Renvoie quand même une valeur par défaut pour ne pas casser l’UI
      res.status(200).json({ tradingFeeBps: 0 });
    }
  }

    if (req.method === "POST") {
      try {
        const { tradingFeeBps } = req.body || {};
        const out = await updateSettings({ tradingFeeBps });
        return res.status(200).json(out);
      } catch (e) {
        console.error("[settings][POST] fail:", e);
        return res.status(500).json({ error: "Échec mise à jour settings" });
      }
    }

    return res.status(405).json({ error: "Méthode non supportée" });
  } catch (e) {
    console.error("[settings][fatal]:", e);
    return res.status(500).json({ error: "Erreur interne" });
  }
}