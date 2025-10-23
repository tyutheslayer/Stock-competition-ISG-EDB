// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const { slug } = req.query;
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "BAD_SLUG" });
    }

    const { attemptId, answers } = req.body || {};
    if (!attemptId || !Array.isArray(answers)) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    // 🔎 On récupère le quiz par slug (et les questions/choix)
    const quiz = await prisma.quiz.findUnique({
      where: { slug },
      include: { questions: { include: { choices: true } } },
    });
    if (!quiz) return res.status(404).json({ error: "Not found" });

    // 🔒 Vérifier que l'attempt appartient bien à l'utilisateur et au bon quiz
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, userId: true, quizId: true, submittedAt: true },
    });
    if (!attempt || attempt.userId !== session.user.id || attempt.quizId !== quiz.id) {
      return res.status(400).json({ error: "ATTEMPT_MISMATCH" });
    }
    if (attempt.submittedAt) {
      return res.status(400).json({ error: "ALREADY_SUBMITTED" });
    }

    // Map des bonnes réponses par question
    const correctByQ = new Map();
    for (const q of quiz.questions) {
      correctByQ.set(q.id, new Set(q.choices.filter(c => c.isCorrect).map(c => c.id)));
    }

    let total = quiz.questions.length;
    let good = 0;

    await prisma.$transaction(async (tx) => {
      // clean si re-submit
      await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });

      for (const a of answers) {
        const qid = a?.questionId;
        const selected = new Set(Array.isArray(a?.choiceIds) ? a.choiceIds : []);
        const correctSet = correctByQ.get(qid) || new Set();

        // égalité stricte d’ensemble
        const isOk = selected.size === correctSet.size && [...selected].every(id => correctSet.has(id));
        if (isOk) good++;

        if (selected.size === 0) {
          await tx.attemptAnswer.create({
            data: { attemptId: attempt.id, questionId: qid, isCorrect: false },
          });
        } else {
          for (const cid of selected) {
            await tx.attemptAnswer.create({
              data: { attemptId: attempt.id, questionId: qid, choiceId: cid, isCorrect: isOk },
            });
          }
        }
      }

      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: { submittedAt: new Date(), scorePct: total ? Math.round((good / total) * 100) : 0 },
      });
    });

    return res.json({ ok: true, total, good, scorePct: total ? Math.round((good / total) * 100) : 0 });
  } catch (e) {
    console.error("[POST quiz/:slug/submit] error:", e);
    // Cette erreur “string did not match expected pattern” venait souvent
    // d’un mauvais id (slug au lieu d’id) → corrigé ci-dessus.
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}