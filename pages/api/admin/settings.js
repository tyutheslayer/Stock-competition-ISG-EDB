// pages/api/admin/settings.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).send("Non authentifié");

  // Check admin
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true }
  });
  if (!me || me.role !== "ADMIN") return res.status(403).send("Interdit");

  if (req.method === "GET") {
    const s = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { feeBps: true }
    });
    return res.json({ feeBps: Number(s?.feeBps || 0) });
  }

  if (req.method === "PATCH" || req.method === "POST") {
    const feeBpsNum = Math.max(0, Math.floor(Number(req.body?.feeBps ?? 0)));
    const s = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: { feeBps: feeBpsNum },
      create: { id: 1, feeBps: feeBpsNum }
    });
    return res.json({ feeBps: s.feeBps });
  }

  return res.status(405).send("Méthode non supportée");
}