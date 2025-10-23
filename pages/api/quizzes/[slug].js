// pages/api/quizzes/[slug].js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Bad slug" });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { choices: true },
      },
    },
  });

  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  // Gate "PLUS" si nécessaire
  if (quiz.visibility === "PLUS") {
    const session = await getServerSession(req, res, authOptions);
    const isPlus = session?.user?.plusStatus === "active" || session?.user?.isPlusActive;
    if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
  }

  return res.json(quiz);
}