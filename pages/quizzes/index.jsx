import { useEffect, useState } from "react";
import PageShell from "../../components/PageShell";
import Link from "next/link";

export default function QuizzesList(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const r=await fetch("/api/quizzes");
      const j=await r.json();
      setRows(Array.isArray(j)?j:[]);
      setLoading(false);
    })();
  },[]);

  return (
    <PageShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-4">Quizzes</h1>
        {loading? "Chargement…" : rows.length===0 ? "Aucun quiz" : (
          <div className="grid md:grid-cols-2 gap-4">
            {rows.map(q=>(
              <div className="glass p-4" key={q.id}>
                <div className="text-sm opacity-70">{q.visibility} • {q.difficulty}</div>
                <h3 className="font-semibold text-lg">{q.title}</h3>
                <div className="mt-2 text-sm opacity-70">{q._count?.questions || 0} questions</div>
                <Link href={`/quizzes/${q.slug}`} className="btn btn-primary btn-sm mt-3">Jouer</Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  );
}