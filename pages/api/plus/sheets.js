import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  // ici on check le statut "Plus"
  if (session.user.plusStatus !== "active") {
    return res.status(403).json({ error: "Plus required" });
  }

  const sheets = await prisma.plusSheet.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json(sheets.map(s => ({
    id: s.id,
    title: s.title,
    url: `/uploads/fiches/${s.filename}`,
    createdAt: s.createdAt
  })));
}