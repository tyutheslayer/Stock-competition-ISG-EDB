// pages/api/settings.js
import prisma from "../../lib/prisma";

// Lecture publique (pas besoin d'être admin) pour afficher les frais dans l’UI
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).end();

    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    const tradingFeeBps = Number(s?.tradingFeeBps ?? 0);

    return res.json({ tradingFeeBps });
  } catch (e) {
    console.error("[settings][GET]", e);
    return res.status(500).json({ error: "Échec lecture settings" });
  }
}