export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol requis" });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    if (!r.ok) return res.status(502).json({ error: "Yahoo indisponible" });

    const data = await r.json();
    const result = data?.chart?.result?.[0];
    const close = result?.indicators?.quote?.[0]?.close || [];
    const points = close.filter(x => Number.isFinite(x));
    if (!points.length) return res.status(404).json({ error: "Pas de données" });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600"); // 5 min
    res.json({ points });
  } catch (e) {
    res.status(500).json({ error: "erreur serveur" });
  }
}
