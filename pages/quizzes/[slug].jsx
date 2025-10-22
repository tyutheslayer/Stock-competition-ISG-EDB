import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell";
import { useRouter } from "next/router";

export default function PlayQuiz(){
  const router = useRouter();
  const { slug } = router.query;
  const [quiz,setQuiz]=useState(null);
  const [answers,setAnswers]=useState({}); // {questionId: Set(choiceIds)}
  const [attempt,setAttempt]=useState(null);
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    if(!slug) return;
    (async()=>{
      const r=await fetch(`/api/quizzes/${slug}`);
      const j=await r.json();
      if(!r.ok){
        if(j?.error==="PLUS_ONLY"){ setMsg("Réservé aux membres EDB Plus."); }
        else setMsg(j?.error || "Introuvable");
        return;
      }
      setQuiz(j);
    })();
  },[slug]);

  async function start(){
    const r=await fetch(`/api/quizzes/${quiz.id}/start`, { method:"POST" });
    const j=await r.json();
    if(!r.ok) return setMsg(j?.error||"Impossible de démarrer");
    setAttempt(j);
  }

  function toggleChoice(qid,cid){
    setAnswers(prev=>{
      const set = new Set(prev[qid] || []);
      if(set.has(cid)) set.delete(cid); else set.add(cid);
      return { ...prev, [qid]: set };
    });
  }

  async function submit(){
    if(!attempt) return setMsg("Commence d’abord le quiz.");
    const payload = {
      attemptId: attempt.id,
      answers: (quiz.questions||[]).map(q=>({
        questionId: q.id,
        choiceIds: Array.from(answers[q.id] || [])
      }))
    };
    const r=await fetch(`/api/quizzes/${quiz.id}/submit`,{
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)
    });
    const j=await r.json();
    if(!r.ok) return setMsg(j?.error||"Soumission échouée");
    setMsg(`Score: ${j.good}/${j.total} (${j.scorePct}%)`);
  }

  if(!quiz) return (
    <PageShell><main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">{msg || "Chargement…"}</main></PageShell>
  );

  return (
    <PageShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="glass p-4">
          <div className="text-sm opacity-70">{quiz.visibility} • {quiz.difficulty}</div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          {!attempt ? (
            <button className="btn btn-primary mt-3" onClick={start}>Commencer</button>
          ) : (
            <div className="mt-2 text-sm">Tentative démarrée.</div>
          )}
        </div>

        {(quiz.questions||[]).map((q,idx)=>(
          <div className="glass p-4 mt-4" key={q.id}>
            <div className="text-sm opacity-70">Question {idx+1}</div>
            <div className="font-semibold">{q.text}</div>
            <div className="mt-2 grid gap-2">
              {q.choices.map(c=>{
                const selected = answers[q.id]?.has(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg border ${selected?"border-primary":"border-white/10"} bg-white/5`}>
                    <input
                      type={q.kind==="SINGLE"?"radio":"checkbox"}
                      name={q.id}
                      checked={!!selected}
                      onChange={()=>toggleChoice(q.id,c.id)}
                      onClick={()=>{
                        if(q.kind==="SINGLE"){
                          // remplace par ce seul choix
                          setAnswers(prev=>({ ...prev, [q.id]: new Set([c.id]) }));
                        }
                      }}
                    />
                    <span>{c.text}</span>
                  </label>
                );
              })}
            </div>
            {attempt && q.explanation && (
              <div className="mt-2 text-xs opacity-60">💡 {q.explanation}</div>
            )}
          </div>
        ))}

        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" onClick={submit} disabled={!attempt}>Valider mes réponses</button>
          {msg && <div className="alert alert-info">{msg}</div>}
        </div>
      </main>
    </PageShell>
  );
}