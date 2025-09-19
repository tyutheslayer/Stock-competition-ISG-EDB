// pages/api/events.ics.js
import prisma from "../../lib/prisma";

// Échappement ICS minimal
function esc(s = "") {
  return String(s).replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}
function fmtDateUTC(dt) {
  // ICS en UTC, format YYYYMMDDTHHMMSSZ
  const d = new Date(dt);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");

    const events = await prisma.event.findMany({
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
        updatedAt: true,
      },
    });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EDB//Calendar//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const ev of events) {
      const uid = `edb-${ev.id}@stock-competition`;
      const dtstamp = fmtDateUTC(ev.updatedAt || ev.startsAt || new Date());
      const dtstart = fmtDateUTC(ev.startsAt);
      const allday = !ev.endsAt && ev.isOpenEnded;
      const summary = esc(`${ev.title}${ev.visibility === "PLUS_ONLY" ? " (Plus)" : ""}`);
      const desc = esc(
        (ev.description || "") +
          (ev.type ? `\nType: ${ev.type}` : "") +
          (ev.visibility ? `\nVisibilité: ${ev.visibility}` : "")
      );

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`SUMMARY:${summary}`);
      if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);

      if (allday) {
        // Évènement "ouvert" → on met juste DTSTART
        lines.push(`DTSTART:${dtstart}`);
      } else {
        lines.push(`DTSTART:${dtstart}`);
        if (ev.endsAt) lines.push(`DTEND:${fmtDateUTC(ev.endsAt)}`);
      }

      if (desc) lines.push(`DESCRIPTION:${desc}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const ics = lines.join("\r\n");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="edb_events.ics"');
    return res.status(200).send(ics);
  } catch (e) {
    console.error("[events][ICS] fatal:", e);
    return res.status(500).send("Erreur ICS");
  }
}