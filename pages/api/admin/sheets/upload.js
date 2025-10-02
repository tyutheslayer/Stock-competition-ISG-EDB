// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]"; // ⬅️ chemin correct (de /api/admin/sheets à /api/auth)
import fs from "fs";
import path from "path";
import formidable from "formidable";

// ⚠️ Next doit laisser formidable gérer le body
export const config = {
  api: { bodyParser: false },
};

// petite aide pour nettoyer un titre en nom de fichier
function sluggify(s = "") {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Assure le répertoire public/uploads/fiches
  const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
  try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}

  const form = formidable({
    multiples: false,
    maxFiles: 1,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;

      const titleRaw = String(fields.title || "").trim();
      const title = titleRaw || "Fiche";
      const f = files.file;
      if (!f) return res.status(400).json({ error: "FILE_REQUIRED" });

      // Dans certaines versions de formidable : f.filepath / f.originalFilename
      const tmpPath = f.filepath || f.path;
      const origName = f.originalFilename || f.name || "fiche.pdf";
      const isPdf = (f.mimetype || "").toLowerCase().includes("pdf") || /\.pdf$/i.test(origName);
      if (!isPdf) return res.status(400).json({ error: "PDF_ONLY" });

      const stamp = Date.now();
      const base = `${stamp}_${sluggify(title) || sluggify(origName.replace(/\.pdf$/i, ""))}`;
      const finalPdf = base + ".pdf";
      const finalJson = base + ".json";

      const destPdf = path.join(baseDir, finalPdf);
      const destMeta = path.join(baseDir, finalJson);

      // déplace le fichier
      await fs.promises.copyFile(tmpPath, destPdf);

      // meta
      const meta = {
        id: base,
        title,
        createdAt: new Date(stamp).toISOString(),
        file: `/uploads/fiches/${finalPdf}`,
      };
      await fs.promises.writeFile(destMeta, JSON.stringify(meta, null, 2), "utf8");

      return res.status(200).json({
        ok: true,
        id: meta.id,
        title: meta.title,
        url: meta.file,
        createdAt: meta.createdAt,
      });
    } catch (e) {
      console.error("[admin sheets upload] error:", e);
      return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
    }
  });
}