// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

function sluggify(s = "") {
  return String(s)
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 80);
}

const isProd = !!process.env.VERCEL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function getBlobModule() {
  try {
    // Empêche Next de résoudre à build-time si le package n'est pas installé
    // eslint-disable-next-line no-eval
    return await eval('import("@vercel/blob")');
  } catch (e) {
    console.warn("[upload] @vercel/blob non disponible:", e?.message || e);
    return null;
  }
}

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
        if (err) {
          console.error("[upload] parse error:", err);
          return res.status(400).json({ error: "FORM_PARSE_FAILED", detail: String(err?.message || err) });
        }

        const title = String(fields.title || "").trim() || "Fiche";
        const f = files.file;
        if (!f) return res.status(400).json({ error: "FILE_REQUIRED" });

        const tmpPath = f.filepath || f.path;
        const origName = f.originalFilename || f.name || "fiche.pdf";
        const mime = (f.mimetype || "").toLowerCase();
        const isPdf = mime.includes("pdf") || /\.pdf$/i.test(origName);
        if (!isPdf) return res.status(400).json({ error: "PDF_ONLY" });

        const stamp = Date.now();
        const base = `${stamp}_${sluggify(title) || sluggify(origName.replace(/\.pdf$/i, ""))}`;
        const finalName = `${base}.pdf`;

        // ---- Vercel Blob si dispo ----
        if (isProd && hasBlob) {
          const blobMod = await getBlobModule();
          if (blobMod?.put) {
            try {
              const buffer = await fs.promises.readFile(tmpPath);
              const { url } = await blobMod.put(`fiches/${finalName}`, buffer, {
                access: "public",
                contentType: "application/pdf",
                token: process.env.BLOB_READ_WRITE_TOKEN,
              });
              return res.status(200).json({
                ok: true,
                id: base,
                title,
                url,
                storage: "blob",
                createdAt: new Date(stamp).toISOString(),
              });
            } catch (be) {
              console.error("[upload] blob.put error:", be);
              // On continue en fallback FS
            }
          }
        }

        // ---- Fallback: système de fichiers local (dev) ----
        try {
          const dir = path.join(process.cwd(), "public", "uploads", "fiches");
          await fs.promises.mkdir(dir, { recursive: true });
          const dest = path.join(dir, finalName);
          await fs.promises.copyFile(tmpPath, dest);
          return res.status(200).json({
            ok: true,
            id: base,
            title,
            url: `/uploads/fiches/${finalName}`,
            storage: "fs",
            createdAt: new Date(stamp).toISOString(),
          });
        } catch (fe) {
          console.error("[upload] FS fallback error:", fe);
          return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(fe?.message || fe) });
        }
      } catch (e) {
        console.error("[upload] handler inner error:", e);
        return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
      }
    });
  } catch (e) {
    console.error("[upload] outer error:", e);
    return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
  }
}