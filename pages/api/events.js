// pages/api/events.js
import prisma from "../../lib/prisma";

/**
 * Query params (optionnels)
 * - from: ISO date (incluse)
 * - to:   ISO date (incluse)
 * - type: EventType ou "ALL" (MINI_COURSE, PLUS_SESSION, EDB_NIGHT, PARTNER_TALK, MASTERMIND, ROADTRIP, OTHER)
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Méthode non supportée" });
    }

    const { from, to, type } = req.query;

    const where = {};
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to)   where.startsAt.lte = new Date(to);
    }
    if (type && type !== "ALL") {
      where.type = type;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        type: true,
        visibility: true,
        location: true,
      },
    });

    // Petit cache côté edge/CDN (les cours ne bougent pas toutes les secondes)
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(events);
  } catch (e) {
    console.error("[events][GET] fatal:", e);
    return res.status(500).json({ error: "Échec récupération événements" });
  }
}