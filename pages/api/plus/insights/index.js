// pages/api/plus/insights/index.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const role = session?.user?.role || null;
    const isPlus =
      session?.user?.isPlusActive === true ||
      session?.user?.plusStatus === "active";
    const isAdmin = role === "ADMIN";

    if (!isPlus && !isAdmin) {
      return res.status(403).json({ error: "PLUS_ONLY" });
    }

    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const filePath = path.join(process.cwd(), "data", "insights.json");

    let payload = null;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      payload = JSON.parse(raw);
    } catch {
      // Fallback d’exemples si aucun fichier présent
      payload = [
        {
          id: "wk-2025-45",
          title: "Momentum CAC 40 — hebdo",
          week: "2025-W45",
          kind: "chart",
          dataset: "line",
          note: "Évolution moyenne hebdo des 10 plus fortes pondérations.",
          data: [
            { label: "Lun", value: 0.3 },
            { label: "Mar", value: 0.8 },
            { label: "Mer", value: 0.5 },
            { label: "Jeu", value: 1.2 },
            { label: "Ven", value: 0.7 }
          ]
        },
        {
          id: "wk-2025-44",
          title: "Flux dividendes — focus France",
          week: "2025-W44",
          kind: "article",
          html: "<p>Sur la semaine, les valeurs à fort dividende ont surperformé de +0,6 pt.</p><ul><li>TotalEnergies</li><li>AXA</li><li>Orange</li></ul>"
        }
      ];
    }

    // On renvoie du plus récent au plus ancien (si déjà trié côté fichier, pas grave)
    const list = Array.isArray(payload) ? payload : [];
    list.sort((a, b) => String(b.week).localeCompare(String(a.week)));

    return res.json(list);
  } catch (e) {
    console.error("[/api/plus/insights] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}