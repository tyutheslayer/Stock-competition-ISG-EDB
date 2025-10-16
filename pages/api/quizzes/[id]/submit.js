// pages/api/quizzes/[id]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

// POST /api/quizzes/[id]/submit
// payload: { attemptId, answers: [{ questionId, selectedIds: [] }] }
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Authentification requise" });
  if (req.method !== "POST") return res.status(405).end();

  const { id } = req.query;
  const { attemptId, answers } = req.body || {};
  if (!attemptId || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Payload invalide" });
  }

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: String(attemptId) },
    include: { quiz: { include: { questions: { include: { choices: true } } } } },
  });

  if (!attempt || attempt.quizId !== id) {
    return res.status(400).json({ error: "Tentative/quiz incohérents" });
  }

  // Corriger
  const qMap = new Map();
  for (const q of attempt.quiz.questions) qMap.set(q.id, q);

  let score = 0;
  const maxScore = attempt.quiz.questions.length;
  const answersToCreate = [];
  const corrections = [];

  for (const q of attempt.quiz.questions) {
    const a = answers.find(x => x.questionId === q.id);
    const selected = new Set((a?.selectedIds || []).map(String));

    const correctChoices = q.choices.filter(c => c.isCorrect).map(c => c.id);
    const correctSet = new Set(correctChoices.map(String));

    // Est correct si sets identiques (SINGLE ou MULTI)
    const sameSize = selected.size === correctSet.size;
    let allMatch = sameSize;
    if (allMatch) {
      for (const cid of selected) {
        if (!correctSet.has(cid)) { allMatch = false; break; }
      }
    }

    if (allMatch) score += 1;

    answersToCreate.push({
      questionId: q.id,
      selectedIds: Array.from(selected),
      isCorrect: allMatch,
    });

    corrections.push({
      question: q.text,
      correctChoices: q.choices.filter(c => c.isCorrect).map(c => c.text),
      explanation: q.explanation || null,
      wasCorrect: allMatch,
    });
  }

  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;

  // Transaction: enregistre réponses + finalise tentative
  await prisma.$transaction([
    prisma.quizAnswer.deleteMany({ where: { attemptId: attempt.id } }), // au cas où re-submit
    prisma.quizAnswer.createMany({
      data: answersToCreate.map(a => ({ ...a, attemptId: attempt.id })),
    }),
    prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { finishedAt: new Date(), score, maxScore, percent },
    }),
  ]);

  res.json({ score, maxScore, percent, corrections });
}