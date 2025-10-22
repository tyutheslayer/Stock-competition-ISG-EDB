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
      select: { id:true, slug:true, title:true, visibility:true, difficulty:true, isDraft:true, createdAt:true, _count:{ select:{ questions:true, attempts:true }}}
    });
    return res.json(list);
  }

  if (req.method === "POST") {
    const { slug, title, description, visibility = "PUBLIC", difficulty = "EASY", isDraft = false, questions = [] } = req.body || {};
    if (!slug || !title) return res.status(400).json({ error: "slug et title requis" });

    const exists = await prisma.quiz.findUnique({ where: { slug } });
    if (exists) return res.status(400).json({ error: "Slug déjà utilisé" });

    const created = await prisma.quiz.create({
      data: {
        slug, title, description, visibility, difficulty, isDraft,
        questions: {
          create: questions.map((q, idx) => ({
            text: q.text,
            kind: q.kind || "SINGLE",
            explanation: q.explanation || null,
            orderIndex: idx,
            choices: { create: (q.choices || []).map(c => ({ text: c.text, isCorrect: !!c.isCorrect })) }
          }))
        }
      },
      include: { questions: { include: { choices: true } } }
    });
    return res.status(201).json(created);
  }

  return res.status(405).end();
}