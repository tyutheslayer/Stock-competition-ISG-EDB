// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import formidable from "formidable";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

function sluggify(s = "") {
  return String(s)
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 80);
}

const isProd = !!process.env.VERCEL; // Vercel -> use Blob
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const form = formidable({ multiples: false, maxFiles: 1, keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
      try {
        if (err) throw err;

        const title = String(fields.title || "").trim() || "Fiche";
        const f = files.file;
        if (!f) return res.status(400).json({ error: "FILE_REQUIRED" });

        const tmpPath = f.filepath || f.path;
        const origName = f.originalFilename || f.name || "fiche.pdf";
        const isPdf = (f.mimetype || "").toLowerCase().includes("pdf") || /\.pdf$/i.test(origName);
        if (!isPdf) return res.status(400).json({ error: "PDF_ONLY" });

        const stamp = Date.now();
        const base = `${stamp}_${sluggify(title) || sluggify(origName.replace(/\.pdf$/i, ""))}`;
        const finalName = `${base}.pdf`;

        // ---- PROD (Vercel Blob) ----
        if (isProd && hasBlob) {
          const arrayBuffer = await fs.promises.readFile(tmpPath);
          const { url } = await put(`fiches/${finalName}`, arrayBuffer, {
            access: "public",
            contentType: "application/pdf",
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });

          return res.status(200).json({
            ok: true,
            id: base,
            title,
            url,              // URL publique
            createdAt: new Date(stamp).toISOString(),
            storage: "blob",
          });
        }

        // ---- DEV (Fs local) ----
        const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
        try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
        const destPdf = path.join(baseDir, finalName);
        await fs.promises.copyFile(tmpPath, destPdf);

        return res.status(200).json({
          ok: true,
          id: base,
          title,
          url: `/uploads/fiches/${finalName}`,
          createdAt: new Date(stamp).toISOString(),
          storage: "fs",
        });
      } catch (e) {
        console.error("[admin sheets upload] error:", e);
        return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
      }
    });
  } catch (e) {
    console.error("[admin sheets upload] outer error:", e);
    return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
  }
}