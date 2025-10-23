// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};

  if (!slug) return res.status(400).json({ error: "MISSING_SLUG" });
  if (!attemptId || typeof attemptId !== "string") {
    return res.status(400).json({ error: "INVALID_ATTEMPT_ID" });
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: "INVALID_ANSWERS" });
  }

  // Vérifie que le quiz existe par SLUG
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: { questions: { include: { choices: true } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // Vérifie que la tentative existe et appartient à l’utilisateur + au bon quiz
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, quizId: true, submittedAt: true },
  });
  if (!attempt) return res.status(404).json({ error: "ATTEMPT_NOT_FOUND" });
  if (attempt.userId !== session.user.id) return res.status(403).json({ error: "FORBIDDEN" });
  if (attempt.quizId !== quiz.id) return res.status(400).json({ error: "ATTEMPT_MISMATCH" });

  // Map des bonnes réponses
  const correctByQ = new Map();
  for (const q of quiz.questions) {
    correctByQ.set(
      q.id,
      new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id))
    );
  }

  const validQids = new Set(quiz.questions.map((q) => q.id));

  let total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    // nettoie les réponses précédentes si resoumission
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of answers) {
      const qid = String(a.questionId || "");
      if (!validQids.has(qid)) continue;

      const selected = new Set((a.choiceIds || []).map(String));
      const correctSet = correctByQ.get(qid) || new Set();

      const isOk = selected.size === correctSet.size && [...selected].every((id) => correctSet.has(id));
      if (isOk) good++;

      if (selected.size === 0) {
        await tx.attemptAnswer.create({
          data: { attemptId, questionId: qid, isCorrect: false },
        });
      } else {
        for (const cid of selected) {
          await tx.attemptAnswer.create({
            data: { attemptId, questionId: qid, choiceId: cid, isCorrect: isOk },
          });
        }
      }
    }

    const scorePct = total ? Math.round((good / total) * 100) : 0;
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: new Date(), scorePct },
    });
  });

  return res.json({ ok: true, total, good, scorePct: total ? Math.round((good / total) * 100) : 0 });
}