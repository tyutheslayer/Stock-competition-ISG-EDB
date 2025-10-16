// pages/api/quizzes/index.js
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";

function isAdmin(session) {
  return session?.user?.role === "ADMIN" || session?.user?.isAdmin === true;
}

// GET  /api/quizzes?visibility=PUBLIC|PLUS&q=&topic=&difficulty=EASY|MEDIUM|HARD
// POST /api/quizzes (admin)  -> crée un quiz complet {title, slug, description, visibility, topic, difficulty, timeLimitSec, isRandomOrder, questions:[{text, kind, explanation, choices:[{text,isCorrect}], orderIndex}]}
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method === "GET") {
    const {
      visibility, q, topic, difficulty,
      take = "50", skip = "0",
    } = req.query;

    const where = {};
    if (visibility === "PUBLIC" || visibility === "PLUS") where.visibility = visibility;
    if (topic) where.topic = topic;
    if (difficulty === "EASY" || difficulty === "MEDIUM" || difficulty === "HARD") where.difficulty = difficulty;

    if (q && String(q).trim()) {
      const needle = String(q).trim();
      where.OR = [
        { title:       { contains: needle, mode: "insensitive" } },
        { description: { contains: needle, mode: "insensitive" } },
        { topic:       { contains: needle, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(take) || 50,
      skip: Number(skip) || 0,
      select: {
        id: true, title: true, slug: true, description: true,
        visibility: true, topic: true, difficulty: true,
        timeLimitSec: true, isRandomOrder: true, createdAt: true, updatedAt: true,
        _count: { select: { questions: true } },
      },
    });

    res.json(rows);
    return;
  }

  if (req.method === "POST") {
    if (!isAdmin(session)) return res.status(403).json({ error: "Admin requis" });

    const {
      title, slug, description,
      visibility = "PUBLIC",
      topic, difficulty = "EASY",
      timeLimitSec = null,
      isRandomOrder = true,
      questions = [],
    } = req.body || {};

    if (!title || !slug) return res.status(400).json({ error: "title et slug requis" });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Au moins une question est requise" });
    }

    const created = await prisma.quiz.create({
      data: {
        title, slug, description: description || null,
        visibility, topic: topic || null, difficulty,
        timeLimitSec: timeLimitSec ? Number(timeLimitSec) : null,
        isRandomOrder: !!isRandomOrder,
        questions: {
          create: questions.map((q, idx) => ({
            text: q.text,
            kind: q.kind || "SINGLE",
            explanation: q.explanation || null,
            orderIndex: Number.isFinite(q.orderIndex) ? q.orderIndex : idx,
            choices: {
              create: (q.choices || []).map(c => ({
                text: c.text,
                isCorrect: !!c.isCorrect,
              })),
            },
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });

    res.status(201).json(created);
    return;
  }

  res.status(405).end();
}