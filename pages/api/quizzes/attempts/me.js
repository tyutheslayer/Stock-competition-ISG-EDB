// pages/api/quizzes/attempts/me.js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";

// GET /api/quizzes/attempts/me  -> historique de l'utilisateur
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Authentification requise" });
  if (req.method !== "GET") return res.status(405).end();

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return res.status(403).json({ error: "Utilisateur inconnu" });

  const rows = await prisma.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    include: {
      quiz: { select: { id: true, title: true, slug: true, visibility: true } },
    },
    take: 50,
  });

  res.json(rows);
}