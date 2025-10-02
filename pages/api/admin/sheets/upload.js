// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { put } from "@vercel/blob";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

function ensureEnv() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error("Missing BLOB_READ_WRITE_TOKEN");
    err.code = "BLOB_TOKEN_MISSING";
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    // Autorise les pré-vols éventuels
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      return res.status(200).end();
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
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50 MB
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    const file = files?.file || files?.pdf || files?.upload;
    if (!file) return res.status(400).json({ error: "NO_FILE" });

    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(file.filepath);

    const rawName = Array.isArray(file.originalFilename)
      ? file.originalFilename[0]
      : (file.originalFilename || "sheet.pdf");

    // Sanitise
    const safeName = rawName.replace(/[^a-z0-9._-]+/gi, "_");
    const folder = "plus-sheets";
    const key = `${folder}/${Date.now()}_${safeName}`;

    const { url } = await put(key, buf, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    // (optionnel) en DB — non requis pour fonctionner
    // await prisma.plusSheet.create({ data: { title, filename: key, uploadedBy: session.user.email } });

    return res.status(200).json({
      ok: true,
      key,
      url,
      title: (Array.isArray(fields?.title) ? fields.title[0] : fields?.title) || safeName.replace(/\.pdf$/i, ""),
    });
  } catch (e) {
    if (e?.code === "BLOB_TOKEN_MISSING") {
      return res.status(500).json({ error: "BLOB_TOKEN_MISSING" });
    }
    if (e?.code === "MODULE_NOT_FOUND") {
      return res.status(500).json({ error: "BLOB_MODULE_MISSING" });
    }
    console.error("[admin/sheets/upload] fail:", e);
    return res.status(500).json({ error: "UPLOAD_FAILED", detail: String(e?.message || e) });
  }
}