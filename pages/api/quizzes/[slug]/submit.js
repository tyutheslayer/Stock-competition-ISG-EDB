import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req,res){
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req,res,authOptions);
  if (!session?.user?.id) return res.status(401).json({ error:"Unauthorized" });

  const { slug } = req.query; // quizId
  const { attemptId, answers } = req.body || {}; // answers: [{questionId, choiceIds:[]}]
  if (!attemptId || !Array.isArray(answers)) return res.status(400).json({ error:"Invalid payload" });

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: { include: { choices:true } } }
  });
  if (!quiz) return res.status(404).json({ error:"Not found" });

  // map corrects
  const correctByQ = new Map();
  for (const q of quiz.questions) {
    correctByQ.set(q.id, new Set(q.choices.filter(c=>c.isCorrect).map(c=>c.id)));
  }

  let total = quiz.questions.length;
  let good = 0;

  // on sauvegarde les answers (une row par choix sélectionné)
  await prisma.$transaction(async(tx)=>{
    // cleanup if resubmit
    await tx.attemptAnswer.deleteMany({ where: { attemptId } });

    for (const a of answers) {
      const selected = new Set(a.choiceIds || []);
      const correctSet = correctByQ.get(a.questionId) || new Set();

      // égalité stricte des ensembles
      const isOk = selected.size === correctSet.size && [...selected].every(id => correctSet.has(id));
      if (isOk) good++;

      for (const cid of selected) {
        await tx.attemptAnswer.create({
          data: {
            attemptId,
            questionId: a.questionId,
            choiceId: cid,
            isCorrect: isOk
          }
        });
      }
      // si rien coché, on log une ligne vide pour tracer
      if (selected.size === 0) {
        await tx.attemptAnswer.create({
          data: { attemptId, questionId: a.questionId, isCorrect: false }
        });
      }
    }

    const scorePct = total ? Math.round((good/total)*100) : 0;
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: new Date(), scorePct }
    });
  });

  res.json({ ok:true, total, good, scorePct: total ? Math.round((good/total)*100) : 0 });
}