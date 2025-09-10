export default async function handler(req, res) {
  const start = process.env.NEXT_PUBLIC_SEASON_START || "2025-09-15T08:00:00Z";
  const end   = process.env.NEXT_PUBLIC_SEASON_END   || "2026-01-15T16:00:00Z";
  const title = process.env.NEXT_PUBLIC_SEASON_TITLE || "Saison compétition ISG";

  const dt = (s) => s.replace(/[-:]/g, "").replace(".000", "");
  const uid = `season-${dt(start)}@stock-competition`;

  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//StockCompetition//ISG//FR
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dt(new Date().toISOString())}
DTSTART:${dt(start)}
DTEND:${dt(end)}
SUMMARY:${title}
END:VEVENT
END:VCALENDAR`;

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"season.ics\"");
  res.status(200).send(ics);
}
