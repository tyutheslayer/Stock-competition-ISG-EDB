import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return res.status(401).json({ error: "Unauthorized" });

  const me = await prisma.user.findUnique({
    where: { email: token.email },
    select: { id: true, role: true },
  });
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    select: { id: true, isDraft: true, visibility: true },
  });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

  // (si tu veux restreindre aux membres Plus)
  // if (quiz.visibility === "PLUS") { ... }

  // S'il existe déjà une tentative non soumise, on la réutilise
  const existing = await prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId: me.id, submittedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });
  if (existing) return res.status(200).json(existing);

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: me.id },
    select: { id: true, quizId: true, userId: true, startedAt: true },
  });

  return res.status(201).json(attempt);
}