// pages/api/events.js
import prisma from "../../lib/prisma";

/**
 * GET /api/events
 * Query (optionnels):
 *  - from: ISO (incluse)
 *  - to:   ISO (incluse)
 *  - type: EventType | "ALL"
 *
 * Renvoie 200 [] si aucun évènement, jamais 500 pour une simple mauvaise requête.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non supportée" });
  }

  // On limite la casse: pas de throw si les params sont mal formés
  const { from, to, type } = req.query;

  // EventType autorisés (doit matcher schema.prisma)
  const EVENT_TYPES = new Set([
    "MINI_COURSE",
    "PLUS_SESSION",
    "EDB_NIGHT",
    "PARTNER_TALK",
    "MASTERMIND",
    "ROADTRIP",
    "OTHER",
  ]);

  // Parsing date safe
  const parseSafeDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  };

  try {
    const where = {};

    const dFrom = parseSafeDate(from);
    const dTo = parseSafeDate(to);
    if (dFrom || dTo) {
      where.startsAt = {};
      if (dFrom) where.startsAt.gte = dFrom;
      if (dTo) where.startsAt.lte = dTo;
    }

    if (type && type !== "ALL" && EVENT_TYPES.has(String(type))) {
      where.type = String(type);
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

    // Cache CDN modeste
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(Array.isArray(events) ? events : []);
  } catch (e) {
    // Log serveur + message explicite côté client
    console.error("[events][GET] fatal:", e);
    return res.status(200).json([]); // On renvoie une liste vide plutôt qu'un 500 côté UI
  }
}