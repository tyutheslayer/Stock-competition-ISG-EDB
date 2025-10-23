// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};

  if (!slug || typeof slug !== "string") return res.status(400).json({ error: "BAD_SLUG" });
  if (!attemptId || typeof attemptId !== "string") {
    return res.status(400).json({ error: "BAD_ATTEMPT_ID" });
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: "BAD_ANSWERS" });
  }

  const quiz = await prisma.quiz.findUnique({ where: { slug }, select: { id: true } });
  if (!quiz) return res.status(404).json({ error: "NOT_FOUND" });

  // Vérifier que la tentative appartient au bon utilisateur ET au bon quiz
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, quizId: true, submittedAt: true },
  });

  if (!attempt) return res.status(400).json({ error: "ATTEMPT_NOT_FOUND" });
  if (attempt.userId !== session.user.id) return res.status(403).json({ error: "ATTEMPT_NOT_YOURS" });
  if (attempt.quizId !== quiz.id) return res.status(400).json({ error: "ATTEMPT_WRONG_QUIZ" });
  if (attempt.submittedAt) return res.status(400).json({ error: "ALREADY_SUBMITTED" });

  const full = await prisma.quiz.findUnique({
    where: { id: quiz.id },
    include: { questions: { include: { choices: true } } },
  });

  const correctByQ = new Map();
  for (const q of full.questions) {
    correctByQ.set(q.id, new Set(q.choices.filter(c => c.isCorrect).map(c => c.id)));
  }

  let total = full.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    // On nettoie des réponses précédentes si re-submit
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of answers) {
      const qid = String(a?.questionId || "");
      const selected = new Set((a?.choiceIds || []).map(String));
      const correct = correctByQ.get(qid) || new Set();

      const isOk = selected.size === correct.size && [...selected].every(id => correct.has(id));
      if (isOk) good++;

      if (selected.size === 0) {
        await tx.attemptAnswer.create({ data: { attemptId, questionId: qid, isCorrect: false } });
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