// pages/api/quizzes/[slug].js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const { slug } = req.query;
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "BAD_SLUG" });
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

    // (Optionnel) Gate EDB Plus
    // const session = await getServerSession(req, res, authOptions);
    // if (quiz.visibility === "PLUS" && !session?.user?.isPlusActive) {
    //   return res.status(403).json({ error: "PLUS_ONLY" });
    // }

    return res.json(quiz);
  } catch (e) {
    console.error("[GET quiz/:slug] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}