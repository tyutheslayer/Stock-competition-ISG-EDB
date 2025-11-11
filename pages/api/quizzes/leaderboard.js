// pages/api/quizzes/leaderboard.js
import prisma from "../../../lib/prisma";

/**
 * GET /api/quizzes/leaderboard?slug=xxx&limit=50
 * - Retourne le classement pour un quiz (par slug).
 * - Classement par scorePct desc, puis submittedAt asc.
 * - Si pas de slug => renvoie la liste des quiz disponibles (id, slug, title).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const { slug, limit = "50" } = req.query;

    if (!slug) {
      const quizzes = await prisma.quiz.findMany({
        where: { isDraft: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, slug: true, title: true },
      });
      return res.json({ quizzes });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { slug: String(slug) },
      select: { id: true, slug: true, title: true },
    });
    if (!quiz) return res.status(404).json({ error: "QUIZ_NOT_FOUND" });

    const lim = Math.max(1, Math.min(200, Number(limit) || 50));

    // On ne prend que les tentatives soumises
    const rows = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, NOT: { submittedAt: null } },
      orderBy: [{ scorePct: "desc" }, { submittedAt: "asc" }],
      take: lim,
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // normalise un "displayName"
    const out = rows.map((r, i) => ({
      rank: i + 1,
      scorePct: r.scorePct ?? 0,
      submittedAt: r.submittedAt,
      user: {
        name: r.user?.name || r.user?.email?.split("@")[0] || "Anonyme",
        email: r.user?.email || null,
      },
    }));

    return res.json({ quiz, leaderboard: out });
  } catch (e) {
    console.error("[GET /api/quizzes/leaderboard] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}