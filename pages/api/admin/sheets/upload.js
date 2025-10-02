// pages/api/admin/sheets/upload.js
import { getServerSession } from "next-auth/next";
// NOTE: ce fichier est dans pages/api/admin/sheets/upload.js
// Pour atteindre pages/api/auth/[...nextauth].js => remonter 2 dossiers
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "../../../../lib/prisma";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthenticated" });

  // Vérif ADMIN via DB (cohérent avec tes autres API)
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!me || me.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  // Import dynamique d'ESM formidable
  const { default: formidable } = await import("formidable");

  // Dossier de destination dans /public (servi statiquement par Next)
  const uploadDir = path.join(process.cwd(), "public", "uploads", "fiches");
  fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
    filename: (_name, _ext, part) => {
      // nom simple + timestamp pour éviter les collisions
      const base = (part.originalFilename || "fiche").replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const ts = Date.now();
      return `${ts}_${base}`;
    },
  });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;

      const file = files?.file;
      if (!file) return res.status(400).json({ error: "FILE_REQUIRED" });

      const filename = path.basename(file.filepath);
      const title = String(fields?.title || file.originalFilename || filename);

      const sheet = await prisma.plusSheet.create({
        data: { title, filename, uploadedBy: session.user.email },
      });

      return res.status(200).json({
        id: sheet.id,
        title: sheet.title,
        url: `/uploads/fiches/${sheet.filename}`,
        createdAt: sheet.createdAt,
      });
    } catch (e) {
      console.error("[admin/sheets/upload] err:", e);
      return res.status(500).json({ error: "UPLOAD_FAILED" });
    }
  });
}