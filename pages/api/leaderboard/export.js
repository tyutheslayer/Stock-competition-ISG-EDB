export default async function handler(req, res) {
  try {
    // On réutilise l’API JSON existante /api/leaderboard
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;
    const r = await fetch(`${base}/api/leaderboard`);
    if (!r.ok) return res.status(502).json({ error: "Leaderboard JSON indisponible" });
    const rows = await r.json(); // [{ user, equity, perf, ... }]

    // Convertit en CSV
    const header = ["rank", "name_or_id", "equity", "perf_pct"];
    const lines = [header.join(",")];
    rows.forEach((row, i) => {
      const name = row.name || row.userName || (row.user?.split("@")[0] ?? row.user);
      const perfPct = (row.perf * 100).toFixed(4);
      lines.push([i + 1, `"${name}"`, row.equity.toFixed(2), perfPct].join(","));
    });

    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=leaderboard.csv");
    // Cache côté edge/CDN (facultatif)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: "Erreur export CSV" });
  }
}
