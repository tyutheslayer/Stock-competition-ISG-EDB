// pages/api/plus/sheets.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

async function getPlusStatus(req, res) {
  try {
    const host = req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const r = await fetch(`${proto}://${host}/api/plus/status`);
    const j = await r.json();
    return String(j?.status || "none").toLowerCase();
  } catch {
    return "none";
  }
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const status = await getPlusStatus(req, res);
  if (status !== "active") return res.status(403).json({ error: "Plus required" });

  const sheets = await prisma.plusSheet.findMany({ orderBy: { createdAt: "desc" } });

  return res.status(200).json(
    sheets.map(s => ({
      id: s.id,
      title: s.title,
      url: `/uploads/fiches/${s.filename}`,
      createdAt: s.createdAt,
    }))
  );
}