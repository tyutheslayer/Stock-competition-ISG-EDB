// pages/api/admin/quizzes/[id].js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ error: "BAD_ID" });

  if (req.method === "DELETE") {
    try {
      await prisma.quizAttempt.deleteMany({ where: { quizId: id } });
      await prisma.question.deleteMany({ where: { quizId: id } }); // choices cascade via relation
      await prisma.quiz.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[DELETE quiz]", e);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
}