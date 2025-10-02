// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]"; // <- adapte le chemin si besoin
import { put } from "@vercel/blob";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false }, // obligatoire pour formidable
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
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Auth admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && !session.user.isAdmin)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    ensureEnv();

    // Parse FormData
    const form = formidable({ multiples: false });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    const file = files?.file || files?.pdf || files?.upload;
    if (!file) return res.status(400).json({ error: "NO_FILE" });

    // Lecture du fichier (Node 18+)
    const fs = await import("node:fs/promises");
    const buf = await fs.readFile(file.filepath);

    const originalName = Array.isArray(file.originalFilename)
      ? file.originalFilename[0]
      : file.originalFilename || "sheet.pdf";

    // Optionnels : méta
    const title = Array.isArray(fields?.title) ? fields.title[0] : fields?.title || originalName;
    const folder = "plus-sheets"; // préfixe dossier dans ton store
    const key = `${folder}/${Date.now()}_${originalName.replace(/\s+/g, "_")}`;

    // Upload vers Vercel Blob
    const { url } = await put(key, buf, {
      access: "public", // ou "private" si tu préfères
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    // (facultatif) Enregistrer la fiche dans ta DB (prisma.synthSheet.create ...)
    // await prisma.synthSheet.create({ data: { title, url, key } });

    return res.status(200).json({ ok: true, title, url, key });
  } catch (e) {
    // codes d’erreurs parlants
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