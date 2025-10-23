// pages/api/quizzes/[slug].js
import prisma from "../../../lib/prisma";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const slug = String(req.query?.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "BAD_SLUG" });

    const quiz = await prisma.quiz.findUnique({
      where: { slug },
      include: { questions: { orderBy: { orderIndex: "asc" }, include: { choices: true } } },
    });
    if (!quiz || quiz.isDraft) return res.status(404).json({ error: "NOT_FOUND" });

    return res.json(quiz);
  } catch (e) {
    console.error("[quiz get] fatal:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: e?.message || String(e) });
  }
}