// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const { slug } = req.query;
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "BAD_SLUG" });
    }

    const quiz = await prisma.quiz.findUnique({ where: { slug } });
    if (!quiz || quiz.isDraft) return res.status(404).json({ error: "Not found" });

    // (Optionnel) Gate EDB Plus
    // if (quiz.visibility === "PLUS" && !session.user.isPlusActive) {
    //   return res.status(403).json({ error: "PLUS_ONLY" });
    // }

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,           // ✅ on utilise bien l'id du quiz trouvé par slug
        userId: session.user.id,   // ✅ id utilisateur de la session
      },
      select: { id: true, quizId: true, startedAt: true },
    });

    return res.status(201).json(attempt);
  } catch (e) {
    console.error("[POST quiz/:slug/start] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}