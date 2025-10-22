// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { put } from "@vercel/blob";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false },
};

function ensureEnv() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error("Missing BLOB_READ_WRITE_TOKEN");
    err.code = "BLOB_TOKEN_MISSING";
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      return res.status(200).end();
    }
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        usage: "POST multipart/form-data with fields: file=<PDF>, title=<optional>",
        path: "/api/admin/sheets/upload",
      });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && !session.user.isAdmin)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    ensureEnv();

    const form = formidable({
      multiples: false,
      allowEmptyFiles: true,
      maxFileSize: 50 * 1024 * 1024,
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    const file = files?.file || files?.pdf || files?.upload;
    if (!file) return res.status(400).json({ error: "NO_FILE" });

    const f = Array.isArray(file) ? file[0] : file;

    const mime = (f.mimetype || f.mime || "").toLowerCase();
    const size = typeof f.size === "number" ? f.size : 0;
    if (size <= 0) {
      return res.status(400).json({ error: "EMPTY_FILE", detail: "Le fichier fait 0 octet" });
    }
    if (mime && !mime.includes("pdf")) {
      return res.status(400).json({ error: "INVALID_TYPE", detail: `Type reçu: ${mime}` });
    }

    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(f.filepath);

    const originalName = Array.isArray(f.originalFilename)
      ? f.originalFilename[0]
      : f.originalFilename || "sheet.pdf";

    const title = Array.isArray(fields?.title) ? fields.title[0] : fields?.title || originalName;
    const folder = "plus-sheets";
    const key = `${folder}/${Date.now()}_${originalName.replace(/\s+/g, "_")}`;

    const { url } = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    return res.status(200).json({ ok: true, title, url, key });
  } catch (e) {
    if (String(e?.message || "").includes("allowEmptyFiles") || String(e?.message || "").includes("file size should be greater than 0")) {
      return res.status(400).json({ error: "EMPTY_FILE", detail: "Le fichier envoyé est vide (0 octet)" });
    }
    if (e?.code === "BLOB_TOKEN_MISSING") {
      return res.status(500).json({ error: "BLOB_TOKEN_MISSING" });
    }
    if (e?.code === "MODULE_NOT_FOUND") {
      return res.status(500).json({ error: "BLOB_MODULE_MISSING" });
    }
    console.error("[sheets/upload] fail:", e);
    return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
  }
}