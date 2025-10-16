// pages/api/quizzes/[id].js
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const { id: idOrSlug } = req.query; // <- Next expose toujours le nom du segment (ici "id"), mais on accepte id ou slug

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) On tente par ID direct
    let quiz = await prisma.quiz.findUnique({
      where: { id: String(idOrSlug) },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { choices: { orderBy: { id: "asc" } } },
        },
      },
    });

    // 2) Sinon, on tente par SLUG
    if (!quiz) {
      quiz = await prisma.quiz.findUnique({
        where: { slug: String(idOrSlug) },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            include: { choices: { orderBy: { id: "asc" } } },
          },
        },
      });
    }

    if (!quiz) return res.status(404).json({ error: "Quiz introuvable" });
    return res.status(200).json(quiz);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}