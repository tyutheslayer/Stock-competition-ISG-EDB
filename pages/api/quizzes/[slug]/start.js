// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import authHandler from "../../auth/[...nextauth]";

// Récupère les authOptions exportées par la route NextAuth
const { authOptions } = authHandler;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid slug" });
  }

  // 🔎 Trouver par SLUG (et refuser les brouillons)
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    select: { id: true, visibility: true, isDraft: true }
  });

  if (!quiz || quiz.isDraft) {
    return res.status(404).json({ error: "Not found" });
  }

  // 🔐 Gate “PLUS” (adapte selon ton modèle utilisateur si besoin)
  // Ici on regarde simplement role === 'PLUS' ou un booléen isPlusActive sur session.user
  if (quiz.visibility === "PLUS") {
    const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active" || session?.user?.role === "PLUS";
    if (!isPlus) return res.status(403).json({ error: "PLUS_ONLY" });
  }

  // (Optionnel) empêcher plusieurs tentatives non soumises
  const existing = await prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId: session.user.id, submittedAt: null },
    select: { id: true }
  });
  if (existing) {
    return res.status(200).json(existing);
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: session.user.id }
  });

  return res.status(201).json(attempt);
}