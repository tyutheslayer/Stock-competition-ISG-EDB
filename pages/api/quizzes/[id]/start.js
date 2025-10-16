// pages/api/quizzes/[id]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

function userIsPlus(session) {
  return session?.user?.plusActive === true || session?.user?.role === "ADMIN" || session?.user?.isAdmin === true;
}

// POST /api/quizzes/[id]/start  -> crée une tentative
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Authentification requise" });
  if (req.method !== "POST") return res.status(405).end();

  const { id } = req.query;

  const quiz = await prisma.quiz.findUnique({
    where: { id: String(id) },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true },
      },
    },
  });

  if (!quiz) return res.status(404).json({ error: "Quiz introuvable" });

  // Gating Plus
  if (quiz.visibility === "PLUS" && !userIsPlus(session)) {
    return res.status(403).json({ error: "Contenu réservé EDB Plus" });
  }

  // Récupère (ou crée) l'utilisateur DB
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return res.status(403).json({ error: "Utilisateur inconnu" });

  const order = [...quiz.questions];
  if (quiz.isRandomOrder) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: user.id,
      // score/max/percent rempliront à la soumission
    },
    select: { id: true, quizId: true, startedAt: true },
  });

  res.status(201).json({
    id: attempt.id,
    quizId: attempt.quizId,
    startedAt: attempt.startedAt,
    questionOrder: order.map(q => q.id),
  });
}