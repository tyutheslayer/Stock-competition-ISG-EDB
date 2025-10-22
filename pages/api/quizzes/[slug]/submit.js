import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};
  if (!slug || typeof slug !== "string") return res.status(400).json({ error: "Invalid slug" });
  if (!attemptId || !Array.isArray(answers)) return res.status(400).json({ error: "Invalid payload" });

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: String(attemptId) },
    include: { quiz: { select: { id: true, slug: true } } },
  });
  if (!attempt || attempt.userId !== session.user.id) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.quiz.slug !== slug) return res.status(400).json({ error: "Attempt/quiz mismatch" });
  if (attempt.submittedAt) return res.status(400).json({ error: "Already submitted" });

  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    include: { questions: { include: { choices: true } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  const correctByQ = new Map();
  for (const q of quiz.questions) {
    correctByQ.set(q.id, new Set(q.choices.filter(c => c.isCorrect).map(c => c.id)));
  }

  let total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });

    for (const a of answers) {
      const qid = String(a.questionId || "");
      const selected = new Set((a.choiceIds || []).map(String));
      const correct = correctByQ.get(qid) || new Set();

      const isOk = selected.size === correct.size && [...selected].every(id => correct.has(id));
      if (isOk) good++;

      if (selected.size > 0) {
        for (const cid of selected) {
          await tx.attemptAnswer.create({
            data: { attemptId: attempt.id, questionId: qid, choiceId: cid, isCorrect: isOk },
          });
        }
      } else {
        await tx.attemptAnswer.create({
          data: { attemptId: attempt.id, questionId: qid, isCorrect: false },
        });
      }
    }

    const scorePct = total ? Math.round((good / total) * 100) : 0;
    await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: new Date(), scorePct },
    });
  });

  const scorePct = total ? Math.round((good / total) * 100) : 0;
  return res.json({ ok: true, total, good, scorePct });
}