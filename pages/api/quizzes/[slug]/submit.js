// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

function asStr(x) {
  return x == null ? "" : String(x).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { slug } = req.query;

    // Auth via JWT (même logique que submit qui fonctionne chez toi)
    const token = await getToken({
      req,
      secureCookie: process.env.NODE_ENV === "production",
    });
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const userId = asStr(token.uid || token.sub);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Charge le quiz par slug (ordre des questions + ids des choix)
    const quiz = await prisma.quiz.findUnique({
      where: { slug: asStr(slug) },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            // on récupère seulement id & isCorrect pour calculer correctCount,
            // sans jamais renvoyer isCorrect au client
            choices: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });
    if (!quiz || quiz.isDraft) {
      return res.status(404).json({ error: "Not found" });
    }

    // (Optionnel) Gate EDB Plus — à activer si besoin
    // if (quiz.visibility === "PLUS") {
    //   const isPlusUser = token?.plusStatus === "active" || token?.isPlusActive === true;
    //   if (!isPlusUser) return res.status(403).json({ error: "PLUS_ONLY" });
    // }

    // ➜ LOGIQUE DE BASE CONSERVÉE : on crée simplement une tentative
    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId },
      select: { id: true, quizId: true, startedAt: true },
    });

    // ➜ AJOUT “détails des réponses” dans la réponse (UI helper, rien écrit en DB)
    // - allowedChoiceIds : pour que le client puisse valider ses payloads
    // - correctCount : nb de réponses attendues (SANS révéler lesquelles)
    // - kind : SINGLE / MULTI
    // - choiceIds : tableau initial vide (modèle prêt à être rempli côté client)
    const questions = (quiz.questions || []).map((q) => ({
      questionId: q.id,
      kind: q.kind,
      allowedChoiceIds: q.choices.map((c) => c.id),
      correctCount: q.choices.filter((c) => c.isCorrect).length,
      choiceIds: [],
    }));

    return res.status(201).json({
      id: attempt.id,
      quizId: attempt.quizId,
      startedAt: attempt.startedAt,
      questions,
    });
  } catch (e) {
    console.error("[QUIZ START] error:", e);
    return res
      .status(500)
      .json({ error: "INTERNAL_ERROR", detail: e?.message || String(e) });
  }
}