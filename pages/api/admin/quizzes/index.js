// pages/api/admin/quizzes/index.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const list = await prisma.quiz.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        visibility: true,
        difficulty: true,
        isDraft: true,
        createdAt: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });
    return res.json(list);
  }

  if (req.method === "POST") {
    const {
      slug,
      title,
      description,
      visibility = "PUBLIC",
      difficulty = "EASY",
      isDraft = false,
      questions = [],
    } = req.body || {};

    if (!slug || !title) return res.status(400).json({ error: "slug et title requis" });

    const exists = await prisma.quiz.findUnique({ where: { slug } });
    if (exists) return res.status(400).json({ error: "Slug déjà utilisé" });

    const created = await prisma.quiz.create({
      data: {
        slug,
        title,
        description: description || null,
        visibility,
        difficulty,
        isDraft: !!isDraft,
        questions: {
          create: (Array.isArray(questions) ? questions : []).map((q, idx) => ({
            text: String(q.text || "").trim(),
            kind: q.kind === "MULTI" ? "MULTI" : "SINGLE",
            explanation: q.explanation ? String(q.explanation) : null,
            orderIndex: idx,
            choices: {
              create: (Array.isArray(q.choices) ? q.choices : []).map((c) => ({
                text: String(c.text || "").trim(),
                isCorrect: !!c.isCorrect,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { choices: true } } },
    });

    return res.status(201).json(created);
  }

  return res.status(405).end();
}