// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "MISSING_SLUG" });

  // ⚠️ on cherche par SLUG (pas par id)
  const quiz = await prisma.quiz.findUnique({ where: { slug: String(slug) } });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  if (quiz.visibility === "PLUS" && !session.user.isPlusActive) {
    return res.status(403).json({ error: "PLUS_ONLY" });
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: session.user.id },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });

  return res.status(201).json(attempt);
}