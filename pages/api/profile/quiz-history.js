// pages/api/profile/quiz-history.js
import prisma from "../../../lib/prisma";

function asStr(x) {
  return x == null ? "" : String(x);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const userId = asStr(req.query.userId).trim();
    const take = Math.min(Math.max(parseInt(req.query.take || "30", 10) || 30, 1), 100);
    if (!userId) return res.status(400).json({ error: "MISSING_USER_ID" });

    // 1) Récupère les tentatives récentes
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take,
      include: {
        quiz: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            visibility: true,
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (attempts.length === 0) return res.json([]);

    // 2) Récupère toutes les réponses liées pour agréger le score si besoin
    const attemptIds = attempts.map(a => a.id);
    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId: { in: attemptIds } },
      select: { attemptId: true, questionId: true, isCorrect: true },
    });

    // 3) Regroupe par tentative → question → “au moins une réponse correcte ?”
    const correctByAttempt = new Map(); // attemptId -> Set(questionIdCorrect)
    for (const ans of answers) {
      if (!ans.isCorrect) continue;
      let set = correctByAttempt.get(ans.attemptId);
      if (!set) {
        set = new Set();
        correctByAttempt.set(ans.attemptId, set);
      }
      set.add(ans.questionId);
    }

    // 4) Construit la réponse prête à afficher
    const out = attempts.map(a => {
      const totalQ = a.quiz?._count?.questions ?? 0;
      let good = 0;
      if (totalQ > 0) {
        const correctSet = correctByAttempt.get(a.id) || new Set();
        good = correctSet.size;
      }
      const scorePct =
        Number.isFinite(a.scorePct) && a.scorePct !== null
          ? Number(a.scorePct)
          : (totalQ ? Math.round((good / totalQ) * 100) : 0);

      return {
        id: a.id,
        quiz: {
          slug: a.quiz?.slug,
          title: a.quiz?.title,
          difficulty: a.quiz?.difficulty,
          visibility: a.quiz?.visibility,
        },
        total: totalQ,
        good,
        scorePct,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
      };
    });

    return res.json(out);
  } catch (e) {
    console.error("[profile/quiz-history] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}