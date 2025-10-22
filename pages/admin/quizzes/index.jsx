// pages/admin/quizzes/index.jsx
import { useEffect, useState } from "react";
import PageShell from "../../../components/PageShell";

export default function AdminQuizzes(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r = await fetch("/api/admin/quizzes");
        const j = await r.json().catch(()=> ({}));
        if(!r.ok){
          setMsg(`Erreur API (${r.status}) — ${j?.error || "?"} ${j?.detail ? `: ${j.detail}` : ""}`);
          setRows([]);
        }else{
          setRows(Array.isArray(j)?j:[]);
          setMsg("");
        }
      }catch(err){
        setMsg(`Erreur de chargement — ${err?.message || err}`);
        setRows([]);
      }finally{
        setLoading(false);
      }
    })();
  },[]);

  return (
    <PageShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-4">Quizzes (admin)</h1>

        <QuickCreate onDone={(ok, m)=>{ setMsg(m||""); if(ok){ location.reload(); } }} />

        {msg && <div className="alert alert-error my-3"><span>{msg}</span></div>}

        {loading ? <div>Chargement…</div> : (
          <div className="overflow-x-auto glass mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Titre</th><th>Slug</th><th>Visibilité</th><th>Diff.</th>
                  <th>Q</th><th>Attempts</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.slug}</td>
                    <td>{r.visibility}</td>
                    <td>{r.difficulty}</td>
                    <td>{r._count?.questions || 0}</td>
                    <td>{r._count?.attempts || 0}</td>
                    <td>{r.isDraft ? "Brouillon" : "Publié"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length===0 && !msg && (
              <div className="p-4 opacity-70">Aucun quiz encore.</div>
            )}
          </div>
        )}
      </main>
    </PageShell>
  );
}

function QuickCreate({ onDone }){
  const [title,setTitle]=useState("");
  const [slug,setSlug]=useState("");
  const [visibility,setVisibility]=useState("PUBLIC");
  const [difficulty,setDifficulty]=useState("EASY");
  const [isDraft,setIsDraft]=useState(false);
  const [loading,setLoading]=useState(false);

  async function submit(){
    if(!title || !slug) return onDone(false,"Titre et slug requis");
    setLoading(true);
    try{
      const body={
        title, slug, visibility, difficulty, isDraft,
        questions: [
          {
            text:"Une action cotée en EUR à 10,00€ double de prix. Sa performance est de ?",
            kind:"SINGLE",
            choices:[
              { text:"+10%", isCorrect:false },
              { text:"+50%", isCorrect:false },
              { text:"+100%", isCorrect:true },
            ],
            explanation:"Passer de 10 à 20 = +100%."
          }
        ]
      };
      const r=await fetch("/api/admin/quizzes",{
        method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body)
      });
      const j=await r.json().catch(()=> ({}));
      if(!r.ok) return onDone(false, `Erreur création (${r.status}) — ${j?.error || "?"} ${j?.detail?`: ${j.detail}`:""}`);
      onDone(true, "Créé ✅");
    }catch(err){
      onDone(false, `Erreur réseau — ${err?.message || err}`);
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="glass p-4">
      <h2 className="font-semibold">Créer un quiz rapide</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <input className="input input-bordered" placeholder="Titre" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="input input-bordered" placeholder="slug-ex: bases-actions" value={slug} onChange={e=>setSlug(e.target.value)} />
        <select className="select select-bordered" value={visibility} onChange={e=>setVisibility(e.target.value)}>
          <option value="PUBLIC">PUBLIC</option>
          <option value="PLUS">PLUS</option>
        </select>
        <select className="select select-bordered" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
          <option value="EASY">EASY</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HARD">HARD</option>
        </select>
        <label className="label cursor-pointer gap-2">
          <span>Brouillon</span>
          <input type="checkbox" className="toggle" checked={isDraft} onChange={()=>setIsDraft(v=>!v)} />
        </label>
      </div>
      <button className={`btn btn-primary mt-3 ${loading?"btn-disabled":""}`} onClick={submit}>
        {loading? "…" : "Créer"}
      </button>
    </div>
  );
}