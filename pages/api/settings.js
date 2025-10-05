// pages/api/settings.js
import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  try {
    // assure la ligne id=1
    const s = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, tradingFeeBps: 0 },
      select: { tradingFeeBps: true, updatedAt: true },
    });
    return res.status(200).json({ tradingFeeBps: s.tradingFeeBps, updatedAt: s.updatedAt });
  } catch (e) {
    console.error("[public settings]", e);
    return res.status(500).json({ error: "SETTINGS_FETCH_FAILED" });
  }
}