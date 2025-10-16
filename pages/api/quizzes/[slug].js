// pages/api/quizzes/[slug].js
import prisma from "../../../lib/prisma";

// GET /api/quizzes/[slug] -> retourne le quiz SANS exposer isCorrect
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { slug } = req.query;

  const quiz = await prisma.quiz.findUnique({
    where: { slug: String(slug) },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { choices: { orderBy: { id: "asc" } } },
      },
    },
  });

  if (!quiz) return res.status(404).json({ error: "Quiz introuvable" });

  // On retire les flags isCorrect pour ne pas divulgâcher
  const sanitized = {
    ...quiz,
    questions: quiz.questions.map(q => ({
      ...q,
      choices: q.choices.map(c => ({ id: c.id, text: c.text })),
    })),
  };

  res.json(sanitized);
}