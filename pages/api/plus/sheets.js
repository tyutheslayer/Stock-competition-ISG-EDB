// pages/api/plus/sheets.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
    try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}

    const names = await fs.promises.readdir(baseDir);
    const metas = [];

    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const full = path.join(baseDir, name);
        const raw = await fs.promises.readFile(full, "utf8");
        const meta = JSON.parse(raw);
        // fallback si meta incomplète
        metas.push({
          id: meta.id || name.replace(/\.json$/i, ""),
          title: meta.title || meta.id || name.replace(/\.json$/i, ""),
          url: meta.file || `/uploads/fiches/${meta.id || name.replace(/\.json$/i, "")}.pdf`,
          createdAt: meta.createdAt || (await fs.promises.stat(full)).mtime.toISOString(),
        });
      } catch {}
    }

    metas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(metas);
  } catch (e) {
    console.error("[plus sheets] list error:", e);
    return res.status(500).json({ error: "LIST_FAILED" });
  }
}