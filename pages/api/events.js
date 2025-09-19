// pages/api/events.js
import prisma from "../../lib/prisma";

/* ---------- Helpers ---------- */
function toIcsDate(dt) {
  // UTC → YYYYMMDDTHHMMSSZ
  const d = new Date(dt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`;
}
function icsEscape(s = "") {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
function buildICS(events) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//EDB//Calendar//FR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const ev of events) {
    const uid = `${ev.id || `${ev.title}-${ev.startsAt}`}@edb`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${icsEscape(uid)}`);
    lines.push(`DTSTAMP:${toIcsDate(new Date())}`);
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);

    if (ev.startsAt) lines.push(`DTSTART:${toIcsDate(ev.startsAt)}`);
    if (ev.endsAt)  lines.push(`DTEND:${toIcsDate(ev.endsAt)}`);

    // Quelques tags utiles dans CATEGORIES
    const cats = [
      ev.type,
      ev.visibility,
      ev.isOpenEnded ? "OPEN_ENDED" : null,
      (ev.location || "").toUpperCase() === "TDB" ? "TDB" : null,
    ].filter(Boolean);
    if (cats.length) lines.push(`CATEGORIES:${icsEscape(cats.join(","))}`);

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* ---------- API ---------- */
export default async function handler(req, res) {
  try {
    // Filtrage basique (optionnel)
    const { from, to, type, visibility, format } = req.query;

    const where = {};
    // bornes temps
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to) where.startsAt.lte = new Date(to);
    }
    // filtrage type
    if (type) {
      const allowed = String(type).split(",").map(s => s.trim()).filter(Boolean);
      if (allowed.length) where.type = { in: allowed };
    }
    // filtrage visibilité
    if (visibility) {
      const allowed = String(visibility).split(",").map(s => s.trim()).filter(Boolean);
      if (allowed.length) where.visibility = { in: allowed };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { title: "asc" }],
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
      },
    });

    // Format ICS ?
    const wantsICS =
      String(format || "").toLowerCase() === "ics" ||
      (req.headers.accept || "").toLowerCase().includes("text/calendar");

    if (wantsICS) {
      const ics = buildICS(events);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="edb_events.ics"`);
      return res.status(200).send(ics);
    }

    // JSON enrichi avec flags UI
    const enriched = events.map(e => ({
      ...e,
      isTdb: (e.location || "").toUpperCase() === "TDB" || /\(TDB\)/i.test(e.title || ""),
      isPlusOnly: e.visibility === "PLUS" || e.visibility === "PRIVATE",
    }));

    // Cache léger côté edge/CDN (peut ajuster)
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.json(enriched);
  } catch (e) {
    console.error("[events][GET] fatal:", e);
    return res.status(500).json({ error: "Impossible de charger les évènements" });
  }
}