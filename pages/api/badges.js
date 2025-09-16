// pages/api/badges.js
import { computeBadgesBundle } from "../../lib/badges";
import { logError } from "../../lib/logger";

export default async function handler(req, res) {
  try {
    const userId = (req.query.userId || "").trim();
    const promo = (req.query.promo || "").trim();
    const period = String(req.query.period || "season").toLowerCase(); // day|week|month|season

    const { rows } = await computeBadgesBundle({ promo, period });

    if (userId) {
      const r = rows.find(x => x.userId === userId);
      return res.json({
        userId,
        period,
        badges: r?.badges ?? [],
        perf: r?.perf ?? 0,
        rank: r?.rank ?? null,
        equity: r?.equity ?? 0
      });
    }

    // Sans userId → renvoyer un tableau (paginable au besoin)
    return res.json({ period, rows });
  } catch (e) {
    logError?.("badges_api", e);
    return res.status(500).json({ error: "Échec calcul badges", detail: e?.message || String(e) });
  }
}