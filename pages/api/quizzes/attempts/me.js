// pages/api/quizzes/attempts/me.js
import prisma from "../../../../lib/prisma";
import { getToken } from "next-auth/jwt";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return res.status(401).json({ error: "UNAUTHORIZED" });

    const me = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });
    if (!me) return res.status(401).json({ error: "UNAUTHORIZED" });

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: me.id },
      orderBy: [{ startedAt: "desc" }],
      include: {
        quiz: { select: { id: true, slug: true, title: true, difficulty: true, visibility: true } },
      },
    });

    return res.json(attempts);
  } catch (e) {
    console.error("[GET /api/quizzes/attempts/me] error:", e);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}