// pages/api/plus/sheets.js
import fs from "fs";
import path from "path";

const isProd = !!process.env.VERCEL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function getBlobModule() {
  try {
    // eslint-disable-next-line no-eval
    return await eval('import("@vercel/blob")');
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // ---- PROD + Blob dispo -> on liste sur Blob
    if (isProd && hasBlob) {
      const blobMod = await getBlobModule();
      if (blobMod?.list) {
        const { blobs } = await blobMod.list({
          prefix: "fiches/",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        const rows = (blobs || [])
          .filter(b => b.pathname?.endsWith(".pdf"))
          .map(b => {
            const name = b.pathname.replace(/^fiches\//, "").replace(/\.pdf$/i, "");
            const title = name.replace(/^\d+_/, "").replace(/-/g, " ");
            return {
              id: name,
              title: title || name,
              url: b.url,
              createdAt: b?.uploadedAt || b?.created || new Date().toISOString(),
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return res.status(200).json(rows);
      }
      // si @vercel/blob indispo: on tombe dans le fallback juste dessous
    }

    // ---- PROD sans Blob -> FS NON ÉCRIVABLE
    if (isProd && !hasBlob) {
      return res.status(200).json({
        ok: true,
        items: [],
        hint: "No BLOB_READ_WRITE_TOKEN configured on Vercel; returning empty list.",
      });
    }

    // ---- DEV/LOCAL -> on peut utiliser le FS
    const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
    // crée le dossier si besoin
    await fs.promises.mkdir(baseDir, { recursive: true }).catch(() => {});

    const files = await fs.promises.readdir(baseDir).catch(() => []);
    const rows = files
      .filter(n => /\.pdf$/i.test(n))
      .map(n => {
        const id = n.replace(/\.pdf$/i, "");
        const title = id.replace(/^\d+_/, "").replace(/-/g, " ");
        return {
          id,
          title: title || id,
          url: `/uploads/fiches/${n}`,
          createdAt: new Date().toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json(rows);
  } catch (e) {
    console.error("[sheets] fatal:", e);
    return res.status(500).json({ error: "SHEETS_FAILED", detail: String(e?.message || e) });
  }
}