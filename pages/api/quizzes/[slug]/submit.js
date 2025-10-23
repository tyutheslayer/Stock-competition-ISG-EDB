// pages/api/quizzes/[slug]/submit.js
export const config = { runtime: "nodejs" };

import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import NextAuth from "../../auth/[...nextauth]";

function isNonEmptyString(x) { return typeof x === "string" && x.trim().length > 0; }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const { authOptions } = NextAuth;
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};

  // ✅ garde-fous côté API (évite l’erreur “string did not match…”)
  if (!isNonEmptyString(attemptId)) {
    return res.status(400).json({ error: "INVALID_ATTEMPT_ID" });
  }
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: "INVALID_ANSWERS" });
  }

  // on résout le quiz par SLUG
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    include: { questions: { include: { choices: true } } }
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // on vérifie que l’attempt appartient bien au bon quiz + à l’utilisateur
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, quizId: true, userId: true, submittedAt: true }
  });
  if (!attempt || attempt.quizId !== quiz.id || attempt.userId !== session.user.id) {
    return res.status(400).json({ error: "ATTEMPT_MISMATCH" });
  }
  if (attempt.submittedAt) {
    return res.status(400).json({ error: "ALREADY_SUBMITTED" });
  }

  // table de vérité des bonnes réponses
  const correctByQ = new Map();
  for (const q of quiz.questions) {
    correctByQ.set(
      q.id,
      new Set(q.choices.filter(c => c.isCorrect).map(c => c.id))
    );
  }

  const total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    // clean précédent submit éventuel
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of answers) {
      const qid = a?.questionId;
      const selected = new Set(Array.isArray(a?.choiceIds) ? a.choiceIds : []);
      const correctSet = correctByQ.get(qid) || new Set();

      const isOk = selected.size === correctSet.size && [...selected].every(id => correctSet.has(id));
      if (isOk) good++;

      if (selected.size === 0) {
        await tx.attemptAnswer.create({
          data: { attemptId, questionId: qid, isCorrect: false }
        });
      } else {
        for (const cid of selected) {
          await tx.attemptAnswer.create({
            data: { attemptId, questionId: qid, choiceId: cid, isCorrect: isOk }
          });
        }
      }
    }

    const scorePct = total ? Math.round((good / total) * 100) : 0;
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: new Date(), scorePct }
    });
  });

  return res.json({ ok: true, total, good, scorePct: total ? Math.round((good / total) * 100) : 0 });
}