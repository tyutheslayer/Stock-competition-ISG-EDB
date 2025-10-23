// pages/api/quizzes/[slug]/start.js
export const config = { runtime: "nodejs" };

import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import NextAuth from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const { authOptions } = NextAuth; // on récupère les options exportées
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  // ✅ chercher par SLUG (le bug venait d’un `id` inexistant)
  const quiz = await prisma.quiz.findUnique({ where: { slug } });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  // Gate PLUS si nécessaire (adapte la logique à ton user)
  if (quiz.visibility === "PLUS") {
    const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active";
    if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: session.user.id },
    select: { id: true, quizId: true, userId: true, startedAt: true }
  });

  return res.status(201).json(attempt);
}