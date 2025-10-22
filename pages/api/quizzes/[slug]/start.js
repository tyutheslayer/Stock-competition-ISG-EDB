// pages/api/quizzes/[slug]/start.js
import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req,res){
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req,res,authOptions);
  if (!session?.user?.id) return res.status(401).json({ error:"Unauthorized" });

  const { slug } = req.query;

  const quiz = await prisma.quiz.findUnique({ where: { slug }, select: { id:true, visibility:true, isDraft:true } });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error:"Not found" });

  if (quiz.visibility === "PLUS") {
    const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active";
    if (!isPlus) return res.status(403).json({ error:"PLUS_ONLY" });
  }

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: session.user.id },
  });
  res.status(201).json(attempt);
}