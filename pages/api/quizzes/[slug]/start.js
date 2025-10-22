import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // ✅ Récupère le user depuis le JWT (pas besoin d'authOptions)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return res.status(401).json({ error: "Unauthorized" });

  const me = await prisma.user.findUnique({
    where: { email: token.email },
    select: { id: true, role: true },
  });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;

  // charge le quiz via le slug
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    select: { id: true, isDraft: true, visibility: true },
  });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  // (optionnel) contrôle EDB Plus selon quiz.visibility === "PLUS"

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: me.id },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });

  return res.status(201).json(attempt);
}