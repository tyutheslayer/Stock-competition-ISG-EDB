// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Bad slug" });
  }

  // ⬇️ le bug venait d'ici : il faut chercher par slug, pas par id
  const quiz = await prisma.quiz.findUnique({ where: { slug } });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  if (quiz.visibility === "PLUS") {
    const isPlus = session?.user?.plusStatus === "active" || session?.user?.isPlusActive;
    if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: session.user.id },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });

  return res.status(201).json(attempt);
}