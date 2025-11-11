// ✅ pages/api/quizzes/attempts/me.js
import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    // Authentifie l’utilisateur via son token JWT NextAuth
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
    });

    if (!token?.email && !token?.sub)
      return res.status(401).json({ error: "UNAUTHORIZED" });

    // Recherche de l'utilisateur par email ou ID du token
    const me = await prisma.user.findFirst({
      where: {
        OR: [
          token.email ? { email: token.email } : undefined,
          token.sub ? { id: token.sub } : undefined,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "UNAUTHORIZED" });

    // Récupère les tentatives avec les bons champs (score + date soumission)
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: me.id },
      orderBy: [{ startedAt: "desc" }],
      select: {
        id: true,
        quizId: true,
        startedAt: true,
        submittedAt: true, // ✅ important pour savoir si le quiz est terminé
        scorePct: true,    // ✅ pour afficher le score
        quiz: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            visibility: true,
          },
        },
      },
    });

    // Réponse structurée
    return res.status(200).json(attempts);
  } catch (e) {
    console.error("[GET /api/quizzes/attempts/me] error:", e);
    return res
      .status(500)
      .json({ error: "INTERNAL_ERROR", detail: e?.message || String(e) });
  }
}