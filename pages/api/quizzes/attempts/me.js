// pages/api/quizzes/attempts/me.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userEmail: session.user.email },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        quizId: true,
        score: true,
        startedAt: true,
        finishedAt: true,
        correctCount: true,
        totalCount: true,
      },
    });
    return res.status(200).json(attempts);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}