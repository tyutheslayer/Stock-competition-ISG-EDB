import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return res.status(401).json({ error: "Unauthorized" });

  const me = await prisma.user.findUnique({
    where: { email: token.email },
    select: { id: true },
  });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const { attemptId, answers } = req.body || {};
  if (!attemptId || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // 1) Quiz via slug
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: { questions: { include: { choices: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // 2) Vérifie la tentative et la propriété
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: String(attemptId) },
    select: { id: true, quizId: true, userId: true, submittedAt: true },
  });
  if (!attempt || attempt.quizId !== quiz.id || attempt.userId !== me.id) {
    return res.status(400).json({ error: "Invalid attempt" });
  }

  // 3) Prépare les maps d’IDs valides + corrects
  const validByQ = new Map();
  const correctByQ = new Map();
  for (const q of quiz.questions) {
    validByQ.set(q.id, new Set(q.choices.map((c) => c.id)));
    correctByQ.set(q.id, new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id)));
  }

  // 4) Normalise les réponses et filtre les IDs invalides
  const norm = [];
  for (const a of answers) {
    const qid = String(a?.questionId || "");
    if (!validByQ.has(qid)) continue;
    const chosen = new Set(
      (Array.isArray(a?.choiceIds) ? a.choiceIds : [])
        .map(String)
        .filter((cid) => validByQ.get(qid).has(cid))
    );
    norm.push({ questionId: qid, choiceIds: [...chosen] });
  }

  // 5) Calcul + enregistrement atomique
  let total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });

    for (const a of norm) {
      const correct = correctByQ.get(a.questionId) || new Set();
      const selected = new Set(a.choiceIds || []);
      const isOk =
        selected.size === correct.size && [...selected].every((cid) => correct.has(cid));

      if (isOk) good++;

      if (selected.size) {
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
        await tx.attemptAnswer.create({
          data: { attemptId: attempt.id, questionId: a.questionId, isCorrect: false },
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