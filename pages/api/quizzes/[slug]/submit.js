// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import authHandler from "../../auth/[...nextauth]";
export const authOptions = authHandler.authOptions || undefined;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};

  if (!attemptId || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // 1) Charger le quiz par SLUG (avec questions + choix)
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: { questions: { include: { choices: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // 2) Vérifier que la tentative existe et appartient au user + au même quiz
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: String(attemptId) },
    select: { id: true, userId: true, quizId: true, submittedAt: true },
  });
  if (!attempt || attempt.userId !== session.user.id || attempt.quizId !== quiz.id) {
    return res.status(400).json({ error: "Invalid attempt" });
  }

  // 3) Construire les ensembles d’IDs valides
  const validQ = new Map();            // questionId -> Set(choiceId valides)
  const correctByQ = new Map();        // questionId -> Set(choiceId corrects)
  for (const q of quiz.questions) {
    const all = new Set(q.choices.map((c) => c.id));
    const ok = new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id));
    validQ.set(q.id, all);
    correctByQ.set(q.id, ok);
  }

  // 4) Normaliser/filtrer les réponses
  const normAnswers = [];
  for (const a of answers) {
    const qid = String(a?.questionId || "");
    if (!validQ.has(qid)) continue;
    const chosen = new Set(
      (Array.isArray(a?.choiceIds) ? a.choiceIds : [])
        .map(String)
        .filter((cid) => validQ.get(qid).has(cid))
    );
    normAnswers.push({ questionId: qid, choiceIds: [...chosen] });
  }

  // 5) Calcul & enregistrement atomique
  let total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    // Efface d’anciens enregistrements si resoumission
    await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });

    for (const a of normAnswers) {
      const correctSet = correctByQ.get(a.questionId) || new Set();
      const selected = new Set(a.choiceIds || []);

      const isOk =
        selected.size === correctSet.size &&
        [...selected].every((cid) => correctSet.has(cid));

      if (isOk) good++;

      if (selected.size > 0) {
        for (const cid of selected) {
          await tx.attemptAnswer.create({
            data: {
              attemptId: attempt.id,
              questionId: a.questionId,
              choiceId: cid,
              isCorrect: isOk,
            },
          });
        }
      } else {
        // rien coché : log minimal
        await tx.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: a.questionId,
            isCorrect: false,
          },
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