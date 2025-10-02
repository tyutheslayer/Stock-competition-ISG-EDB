// pages/api/plus/sheets.js
import fs from "fs";
import path from "path";
import { list } from "@vercel/blob";

const isProd = !!process.env.VERCEL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {
    // ---- PROD (Blob) ----
    if (isProd && hasBlob) {
      const { blobs } = await list({ prefix: "fiches/", token: process.env.BLOB_READ_WRITE_TOKEN });
      const rows = blobs
        .filter(b => b.pathname.endsWith(".pdf"))
        .map(b => {
          const name = b.pathname.replace(/^fiches\//, "").replace(/\.pdf$/i, "");
          // titre lisible à partir du slug sans timestamp
          const title = name.replace(/^\d+_/, "").replace(/-/g, " ");
          return {
            id: name,
            title: title || name,
            url: b.url,
            createdAt: b.uploadedAt || b.created || new Date().toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json(rows);
    }

    // ---- DEV (FS) ----
    const baseDir = path.join(process.cwd(), "public", "uploads", "fiches");
    try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
    const files = await fs.promises.readdir(baseDir);
    const rows = files
      .filter(n => n.endsWith(".pdf"))
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
    console.error("[plus sheets] list error:", e);
    return res.status(500).json({ error: "LIST_FAILED", detail: String(e?.message || e) });
  }
}