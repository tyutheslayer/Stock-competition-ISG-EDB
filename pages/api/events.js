// pages/api/events.js
import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  try {
    // Cache côté edge/CDN (30s) + SWR
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

    const {
      type,          // ex: 'MINI_COURSE', 'PLUS_SESSION', 'EDB_NIGHT', ...
      visibility,    // 'PUBLIC' | 'PLUS_ONLY'
      from,          // ISO date min (inclus)
      to,            // ISO date max (exclus)
      q              // recherche texte (title/description)
    } = req.query;

    const where = {};

    if (type) where.type = String(type).toUpperCase();
    if (visibility) where.visibility = String(visibility).toUpperCase();

    // Fenêtre temporelle
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to)   where.startsAt.lte = new Date(to);
    }

    // Recherche simple
    if (q && q.trim()) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } }
      ];
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        isOpenEnded: true,
        type: true,
        visibility: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(events);
  } catch (e) {
    console.error("[events][GET] fatal:", e);
    return res.status(500).json({ error: "Impossible de charger les évènements" });
  }
}