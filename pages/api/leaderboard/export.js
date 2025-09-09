export default async function handler(req, res) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;

    // Récupère données classement + map email->(name, role)
    const [rLb, rNames] = await Promise.all([
      fetch(`${base}/api/leaderboard`),
      fetch(`${base}/api/leaderboard/names`)
    ]);
    if (!rLb.ok) return res.status(502).json({ error: "Leaderboard JSON indisponible" });

    const rows = await rLb.json();               // [{ user, equity, perf, ... }]
    const namesMap = rNames.ok ? await rNames.json() : {}; // { email: { name, role } }

    // Helpers
    const displayName = (row) => {
      const byEmail = row.user && namesMap[row.user];
      if (byEmail?.name) return byEmail.name;
      if (row.name) return row.name;
      if (row.userName) return row.userName;
      if (row.user && row.user.includes("@")) return row.user.split("@")[0];
      return "Joueur";
    };
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; // CSV-safe
    };

    // CSV
    const header = ["rank", "name", "equity", "perf_pct"];
    const lines = [header.join(",")];

    rows.forEach((row, i) => {
      const name = displayName(row);
      const perfPct = (row.perf * 100).toFixed(4);
      const equity = row.equity.toFixed(2);
      lines.push([i + 1, esc(name), equity, perfPct].join(","));
    });

    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=leaderboard.csv");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: "Erreur export CSV" });
  }
}
