// pages/api/quizzes/[slug]/submit.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export const config = { runtime: "nodejs" };

// petite aide: transforme valeur en string propre
const s = (v) => (v == null ? "" : String(v));

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });

  const slug = s(req.query?.slug).trim();
  const attemptId = s(req.body?.attemptId).trim();
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

  if (!slug) return res.status(400).json({ error: "BAD_SLUG" });
  if (!attemptId) return res.status(400).json({ error: "BAD_ATTEMPT_ID" });

  // 1) Récupérer quiz par slug
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!quiz) return res.status(404).json({ error: "QUIZ_NOT_FOUND" });

  // 2) Charger la tentative et vérifier propriétaire + bon quiz
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, quizId: true, submittedAt: true },
  });
  if (!attempt) return res.status(400).json({ error: "ATTEMPT_NOT_FOUND" });
  if (attempt.userId !== session.user.id) return res.status(403).json({ error: "ATTEMPT_NOT_YOURS" });
  if (attempt.quizId !== quiz.id) return res.status(400).json({ error: "ATTEMPT_WRONG_QUIZ" });
  if (attempt.submittedAt) return res.status(400).json({ error: "ALREADY_SUBMITTED" });

  // 3) Charger toutes les questions/choix du quiz, construire des maps d'IDs valides
  const full = await prisma.quiz.findUnique({
    where: { id: quiz.id },
    include: { questions: { include: { choices: true } } },
  });

  const questionMap = new Map(); // qid -> { id, choices: Map(cid->choice) }
  for (const q of full.questions) {
    const cm = new Map();
    for (const c of q.choices) cm.set(c.id, c);
    questionMap.set(q.id, { ...q, choicesMap: cm });
  }

  // 4) Normaliser + filtrer les réponses reçues (on enlève tout ID inconnu)
  const normalized = [];
  for (const a of answers) {
    const qid = s(a?.questionId).trim();
    const q = questionMap.get(qid);
    if (!q) continue; // question inconnue -> ignore

    const provided = new Set((Array.isArray(a?.choiceIds) ? a.choiceIds : []).map((x) => s(x).trim()).filter(Boolean));
    const validForQ = new Set([...provided].filter((cid) => q.choicesMap.has(cid))); // ne garder que des choix existants

    normalized.push({ questionId: qid, choiceIds: [...validForQ] });
  }

  // 5) Calcul du score + écriture transactionnelle
  let total = full.questions.length;
  let good = 0;

  try {
    await prisma.$transaction(async (tx) => {
      // On nettoie des éventuelles réponses précédentes
      await tx.attemptAnswer.deleteMany({ where: { attemptId } });

      for (const a of normalized) {
        const q = questionMap.get(a.questionId);
        const selected = new Set(a.choiceIds);
        const correct = new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id));

        const isOk = selected.size === correct.size && [...selected].every((id) => correct.has(id));
        if (isOk) good++;

        if (selected.size === 0) {
          // log “aucune réponse”
          await tx.attemptAnswer.create({
            data: { attemptId, questionId: q.id, isCorrect: false },
          });
        } else {
          // log chaque choix sélectionné (tous validés côté schéma)
          for (const cid of selected) {
            await tx.attemptAnswer.create({
              data: { attemptId, questionId: q.id, choiceId: cid, isCorrect: isOk },
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
  } catch (e) {
    // Prisma remonte ce message quand un ID n’a pas le “pattern” attendu
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      detail: "WRITE_FAILED_IDS",
      message: e?.message || String(e),
    });
  }

  return res.json({ ok: true, total, good, scorePct: total ? Math.round((good / total) * 100) : 0 });
}