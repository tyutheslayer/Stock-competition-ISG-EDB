import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/PageShell";

function QuizCard({ q, isPlusActive }) {
  const locked = q.visibility === "PLUS" && !isPlusActive;
  return (
    <div className="glass p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{q.title}</h3>
          {q.visibility === "PLUS" && (
            <span className={`badge ${locked ? "badge-error" : "badge-success"}`}>
              {locked ? "Plus requis" : "Plus"}
            </span>
          )}
        </div>
        <div className="text-sm opacity-70 mt-1">{q.description || "—"}</div>
        <div className="text-xs opacity-60 mt-2">
          {q.topic ? <>Thème : {q.topic} · </> : null}
          Difficulté : {q.difficulty.toLowerCase()}
          {q.timeLimitSec ? <> · {Math.round(q.timeLimitSec/60)} min</> : null}
        </div>
      </div>
      <div className="mt-3">
        <a
          href={locked ? "/plus" : `/quizzes/${q.slug}`}
          className={`btn btn-sm ${locked ? "btn-outline" : "btn-primary"}`}
        >
          {locked ? "Débloquer" : "Commencer"}
        </a>
      </div>
    </div>
  );
}

export default function QuizzesIndex() {
  const [rows, setRows] = useState([]);
  const [isPlusActive, setIsPlusActive] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/plus/status").then(r=>r.json()).catch(()=>({status:"none"}));
      setIsPlusActive(String(s?.status).toLowerCase()==="active");
      const r = await fetch("/api/quizzes").then(r=>r.json()).catch(()=>[]);
      setRows(Array.isArray(r)?r:[]);
    })();
  }, []);

  const filtered = useMemo(()=>{
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(x => (`${x.title} ${x.description} ${x.topic}`).toLowerCase().includes(n));
  }, [rows, q]);

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h1 className="text-3xl font-bold">Quiz</h1>
          <input className="input input-bordered w-72" placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        {filtered.length===0 ? (
          <div className="opacity-70">Aucun quiz pour le moment.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(qz => <QuizCard key={qz.id} q={qz} isPlusActive={isPlusActive} />)}
          </div>
        )}
      </main>
    </PageShell>
  );
}