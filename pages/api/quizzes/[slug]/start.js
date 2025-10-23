// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });

    const slug = String(req.query?.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "BAD_SLUG" });

    // ⚠️ On charge par slug (ton ancienne version cherchait par 'id')
    const quiz = await prisma.quiz.findUnique({
      where: { slug },
      select: { id: true, visibility: true, isDraft: true },
    });
    if (!quiz || quiz.isDraft) return res.status(404).json({ error: "QUIZ_NOT_FOUND" });

    // Gate “PLUS” (si tu utilises un flag plusStatus côté session)
    if (quiz.visibility === "PLUS") {
      const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active";
      if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
    }

    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: session.user.id },
      select: { id: true, quizId: true, userId: true, startedAt: true },
    });

    return res.status(201).json(attempt);
  } catch (e) {
    console.error("[quiz start] fatal:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: e?.message || String(e) });
  }
}