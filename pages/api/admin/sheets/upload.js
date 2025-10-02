import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.isAdmin) return res.status(403).json({ error: "Forbidden" });

  const uploadDir = path.join(process.cwd(), "public/uploads/fiches");
  fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({ multiples: false, uploadDir, keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    const file = files.file;
    const filename = path.basename(file.filepath);
    const title = fields.title || file.originalFilename;

    const sheet = await prisma.plusSheet.create({
      data: { title, filename, uploadedBy: session.user.email }
    });

    res.status(200).json(sheet);
  });
}