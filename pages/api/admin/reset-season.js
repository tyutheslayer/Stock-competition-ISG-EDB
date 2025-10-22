// pages/api/admin/reset-season.js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "POST") return res.status(405).end();

  const startingCash = Number(req.body?.startingCash ?? 100000);
  if (!Number.isFinite(startingCash) || startingCash <= 0) {
    return res.status(400).json({ error: "startingCash invalide" });
  }

  await prisma.order.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.user.updateMany({ data: { cash: startingCash, startingCash } });

  res.json({ ok: true, startingCash });
}