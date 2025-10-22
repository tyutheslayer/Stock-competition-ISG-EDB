// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};
  if (!attemptId || !Array.isArray(answers)) return res.status(400).json({ error: "Invalid payload" });

  // ✅ récup du quiz par slug
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    include: { questions: { include: { choices: true } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // (optionnel) vérifier que l’attempt correspond à ce quiz et à ce user
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== session.user.id || attempt.quizId !== quiz.id) {
    return res.status(400).json({ error: "Attempt mismatch" });
  }

  const correctByQ = new Map();
  for (const q of quiz.questions) {
    correctByQ.set(q.id, new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id)));
  }

  const total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of answers) {
      const selected = new Set(a.choiceIds || []);
      const correctSet = correctByQ.get(a.questionId) || new Set();

      const isOk = selected.size === correctSet.size && [...selected].every((id) => correctSet.has(id));
      if (isOk) good++;

      for (const cid of selected) {
        await tx.attemptAnswer.create({
          data: {
            attemptId,
            questionId: a.questionId,
            choiceId: cid,
            isCorrect: isOk,
          },
        });
      }
      if (selected.size === 0) {
        await tx.attemptAnswer.create({
          data: { attemptId, questionId: a.questionId, isCorrect: false },
        });
      }
    }

    const scorePct = total ? Math.round((good / total) * 100) : 0;
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: new Date(), scorePct },
    });
  });

  const scorePct = total ? Math.round((good / total) * 100) : 0;
  res.json({ ok: true, total, good, scorePct });
}