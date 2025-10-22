// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import authHandler from "../../auth/[...nextauth]"; // on importe la config via le handler
export const authOptions = authHandler.authOptions || undefined;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;

  // charge le quiz par SLUG
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    select: { id: true, isDraft: true, visibility: true },
  });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  // 🔒 Si visibilité PLUS, tu peux ajouter ton contrôle d’abonnement ici si besoin

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: session.user.id,
    },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });

  return res.status(201).json(attempt);
}