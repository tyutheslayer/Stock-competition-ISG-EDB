import prisma from "../../../lib/prisma";
export default async function handler(req,res){
  if (req.method !== "GET") return res.status(405).end();
  const list = await prisma.quiz.findMany({
    where: { isDraft: false },
    orderBy: { createdAt:"desc" },
    select: { id:true, slug:true, title:true, visibility:true, difficulty:true, createdAt:true, _count:{ select:{ questions:true, attempts:true } } }
  });
  res.json(list);
}