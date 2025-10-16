import { useEffect, useMemo, useState } from "react";

export default function QuizRunner({ quiz, attempt }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: Set(choiceId) }
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(quiz.timeLimitSec || null);

  useEffect(()=>{
    if (!quiz.timeLimitSec) return;
    const t = setInterval(()=> setRemaining((s)=> s>0 ? s-1 : 0), 1000);
    return ()=> clearInterval(t);
  }, [quiz.timeLimitSec]);

  useEffect(()=>{
    if (remaining === 0 && !result) submit();
  }, [remaining]); // auto-submit si timer finit

  const qList = quiz.questions?.sort((a,b)=>a.orderIndex-b.orderIndex) || [];
  const q = qList[step];

  function toggleChoice(qid, cid, kind) {
    setAnswers(prev=>{
      const cur = new Set(prev[qid] || []);
      if (kind === "SINGLE") {
        return { ...prev, [qid]: new Set([cid]) };
      }
      if (cur.has(cid)) cur.delete(cid); else cur.add(cid);
      return { ...prev, [qid]: cur };
    });
  }

  async function submit() {
    const payload = {
      attemptId: attempt.id,
      answers: qList.map(qq => ({
        questionId: qq.id,
        selectedIds: Array.from(answers[qq.id] || [])
      }))
    };
    const r = await fetch(`/api/quizzes/${quiz.id}/submit`, { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify(payload) });
    const j = await r.json();
    setResult(j);
  }

  if (result) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass p-5">
          <h2 className="text-xl font-bold">Résultat</h2>
          <div className="mt-1">Score : <b>{result.score}</b> / {result.maxScore} — {result.percent.toFixed(1)}%</div>
          <div className="mt-4 space-y-4">
            {result.corrections?.map((c,i)=>(
              <div key={i} className="rounded-xl bg-white/5 p-3">
                <div className="font-medium">{c.question}</div>
                <div className="text-sm mt-1">
                  Correct : {c.correctChoices.join(", ") || "—"}
                </div>
                {c.explanation && <div className="text-sm opacity-80 mt-1">{c.explanation}</div>}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <a href="/quizzes" className="btn btn-outline">Retour aux quiz</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="glass p-5">
        <div className="flex items-center justify-between">
          <div>Question {step+1}/{qList.length}</div>
          {remaining!=null && <div className="badge">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</div>}
        </div>
        <div className="mt-3 text-lg font-semibold">{q.text}</div>

        <div className="mt-3 space-y-2">
          {q.choices.map(c => {
            const selected = (answers[q.id] || new Set()).has(c.id);
            return (
              <label key={c.id} className={`flex items-center gap-2 rounded-xl p-2 cursor-pointer ${selected?"bg-white/10":"bg-white/5"}`}>
                <input
                  type={q.kind==="SINGLE"?"radio":"checkbox"}
                  name={q.id}
                  checked={selected}
                  onChange={()=>toggleChoice(q.id, c.id, q.kind)}
                />
                <span>{c.text}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between">
          <button className="btn btn-ghost" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Précédent</button>
          {step < qList.length-1 ? (
            <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)}>Suivant</button>
          ) : (
            <button className="btn btn-success" onClick={submit}>Valider le quiz</button>
          )}
        </div>
      </div>
    </main>
  );
}