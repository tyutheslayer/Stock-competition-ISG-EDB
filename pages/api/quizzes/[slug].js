import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req,res){
  const { slug } = req.query;
  if (req.method !== "GET") return res.status(405).end();
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    include: { questions: { orderBy:{orderIndex:"asc"}, include:{ choices:true } } }
  });
  if (!quiz || quiz.isDraft) return res.status(404).json({ error:"Not found" });

  // Gate “PLUS”
  if (quiz.visibility === "PLUS") {
    const session = await getServerSession(req,res,authOptions);
    const isPlus = session?.user?.isPlusActive || session?.user?.plusStatus === "active"; // adapte selon ton User
    if (!isPlus) {
      return res.status(403).json({ error:"PLUS_ONLY" });
    }
  }

  res.json(quiz);
}