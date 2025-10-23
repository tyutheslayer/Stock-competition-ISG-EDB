// pages/api/quizzes/[slug].js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "MISSING_SLUG" });

  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { choices: true },
      },
    },
  });

  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  if (quiz.visibility === "PLUS") {
    const session = await getServerSession(req, res, authOptions);
    const isPlus = !!session?.user?.isPlusActive;
    if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
  }

  return res.json(quiz);
}