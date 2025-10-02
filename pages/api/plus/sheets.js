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
    console.warn("[sheets] @vercel/blob non disponible:", e?.message || e);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    // --- Prod + Blob dispo ---
    if (isProd && hasBlob) {
      const blobMod = await getBlobModule();
      if (blobMod?.list) {
        try {
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
        } catch (be) {
          console.error("[sheets] blob.list error:", be);
          // on retombe en FS
        }
      }
    }

    // --- Fallback: FS local ---
    try {
      const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
      await fs.promises.mkdir(baseDir, { recursive: true });
      const files = await fs.promises.readdir(baseDir);
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
    } catch (fe) {
      console.error("[sheets] FS list error:", fe);
      return res.status(500).json({ error: "LIST_FAILED", detail: String(fe?.message || fe) });
    }
  } catch (e) {
    console.error("[sheets] fatal:", e);
    return res.status(500).json({ error: "SHEETS_FAILED", detail: String(e?.message || e) });
  }
}