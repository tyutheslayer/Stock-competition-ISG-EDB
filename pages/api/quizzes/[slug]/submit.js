import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

// UUID v4 (ou générique) — adapte si besoin
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return res.status(401).json({ error: "Unauthorized" });

  const me = await prisma.user.findUnique({
    where: { email: token.email },
    select: { id: true },
  });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  let { attemptId, answers } = req.body || {};

  // Charge le quiz complet
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: { questions: { include: { choices: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!quiz) return res.status(404).json({ error: "Not found" });

  // Si pas d’attemptId valide, on prend la dernière tentative non soumise
  if (!attemptId || typeof attemptId !== "string" || !UUID_RE.test(attemptId)) {
    const fallback = await prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, userId: me.id, submittedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (!fallback) {
      return res.status(400).json({ error: "Invalid attemptId (expecting UUID) and no open attempt found" });
    }
    attemptId = fallback.id;
  }

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid payload: answers must be an array" });
  }

  // Vérifie l’appartenance de la tentative
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, quizId: true, userId: true, submittedAt: true },
  });
  if (!attempt || attempt.quizId !== quiz.id || attempt.userId !== me.id) {
    return res.status(400).json({ error: "Invalid attempt" });
  }

  // Prépare maps d’IDs valides & bonnes réponses
  const validByQ = new Map();
  const correctByQ = new Map();
  for (const q of quiz.questions) {
    validByQ.set(q.id, new Set(q.choices.map((c) => c.id)));
    correctByQ.set(q.id, new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id)));
  }

  // Normalise les réponses et filtre IDs invalides (et formats non-UUID)
  const norm = [];
  for (const a of answers) {
    const qid = String(a?.questionId || "");
    if (!validByQ.has(qid)) continue;

    const choiceIds = Array.isArray(a?.choiceIds) ? a.choiceIds : [];
    const filtered = choiceIds
      .map(String)
      .filter((cid) => validByQ.get(qid).has(cid)); // on garde uniquement les choix qui appartiennent à la question

    norm.push({ questionId: qid, choiceIds: filtered });
  }

  let total = quiz.questions.length;
  let good = 0;

  await prisma.$transaction(async (tx) => {
    // On nettoie un éventuel précédent enregistrement
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of norm) {
      const correct = correctByQ.get(a.questionId) || new Set();
      const selected = new Set(a.choiceIds || []);
      const isOk =
        selected.size === correct.size &&
        [...selected].every((cid) => correct.has(cid));

      if (isOk) good++;

      if (selected.size) {
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
      } else {
        // trace "pas de réponse"
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
  return res.json({ ok: true, total, good, scorePct });
}