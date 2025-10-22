import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || !(session.user.isAdmin || session.user.role === "ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id } = req.query;

  if (req.method === "GET") {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy:{orderIndex:"asc"}, include: { choices:true } } }
    });
    if (!quiz) return res.status(404).json({ error: "Not found" });
    return res.json(quiz);
  }

  if (req.method === "PUT") {
    const { title, description, visibility, difficulty, isDraft, questions } = req.body || {};
    // stratégie simple: on remplace tout (question/choice)
    const updated = await prisma.$transaction(async(tx)=>{
      await tx.choice.deleteMany({ where: { question: { quizId: id } } });
      await tx.question.deleteMany({ where: { quizId: id } });
      const q = await tx.quiz.update({
        where: { id },
        data: {
          title, description, visibility, difficulty, isDraft,
          questions: {
            create: (questions||[]).map((q, idx)=>({
              text: q.text, kind: q.kind || "SINGLE", explanation: q.explanation || null, orderIndex: idx,
              choices: { create: (q.choices||[]).map(c=>({ text:c.text, isCorrect:!!c.isCorrect })) }
            }))
          }
        },
        include: { questions: { include: { choices:true } } }
      });
      return q;
    });
    return res.json(updated);
  }

  if (req.method === "DELETE") {
    await prisma.quiz.delete({ where: { id } });
    return res.status(204).end();
  }

  return res.status(405).end();
}