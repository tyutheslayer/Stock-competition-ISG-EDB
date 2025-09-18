// pages/api/events.js
export default function handler(req, res) {
  // Mini-cours tous les jeudis 13:00–13:30 (prochaines occurrences, mock)
  const now = new Date();
  const events = [];
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  // Trouver le prochain jeudi
  const day = now.getDay(); // 0=dim
  const toThu = (4 - day + 7) % 7; // 4 = jeudi
  let cursor = addDays(now, toThu || 7); // cette semaine si à venir sinon semaine pro

  for (let i = 0; i < 6; i++) {
    const start = new Date(cursor);
    start.setHours(13, 0, 0, 0);
    const end = new Date(cursor);
    end.setHours(13, 30, 0, 0);
    events.push({
      id: `mini-${i}`,
      title: "Mini-cours gratuit",
      start: start.toISOString(),
      end: end.toISOString(),
      type: "Mini-cours",
      access: "free",
    });
    cursor = addDays(cursor, 7);
  }

  // Exemple d’événements Plus
  const plusStart = addDays(now, 5);
  plusStart.setHours(18, 0, 0, 0);
  const plusEnd = new Date(plusStart);
  plusEnd.setHours(19, 0, 0, 0);
  events.push({
    id: "plus-1",
    title: "Atelier Plus : Construire un portefeuille",
    start: plusStart.toISOString(),
    end: plusEnd.toISOString(),
    type: "Atelier",
    access: "plus",
  });

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(events);
}