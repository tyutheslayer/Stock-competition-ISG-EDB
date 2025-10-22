// pages/admin/quizzes/index.jsx
import { useEffect, useState } from "react";
import PageShell from "../../../components/PageShell";

export default function AdminQuizzes(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        setLoading(true);
        const r=await fetch("/api/admin/quizzes");
        const j=await r.json();
        setRows(Array.isArray(j)?j:[]);
      }catch(e){
        setMsg("Erreur de chargement des quizzes.");
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

        {msg && <div className={`alert ${/Erreur/i.test(msg) ? "alert-error":"alert-info"} my-3`}><span>{msg}</span></div>}

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
          </div>
        )}
      </main>
    </PageShell>
  );
}

function QuickCreate({ onDone }){
  const [title,setTitle]=useState("");
  const [slug,setSlug]=useState("");
  const [visibility,setVisibility]=useState("PUBLIC"); // enum
  const [difficulty,setDifficulty]=useState("EASY");   // enum
  const [isDraft,setIsDraft]=useState(false);
  const [loading,setLoading]=useState(false);

  // JSON avancé
  const [useJson,setUseJson]=useState(false);
  const [jsonText,setJsonText]=useState(`{
  "description": "Mini quiz d’intro",
  "questions": [
    {
      "text": "Une action passe de 10€ à 20€. La performance est ?",
      "kind": "SINGLE",
      "explanation": "10 -> 20 = +100%",
      "choices": [
        { "text": "+10%",  "isCorrect": false },
        { "text": "+50%",  "isCorrect": false },
        { "text": "+100%", "isCorrect": true  }
      ]
    }
  ]
}`);

  function parseJsonOrFail(){
    if(!useJson) return { description:null, questions:null };
    try{
      const obj = JSON.parse(jsonText);
      if (obj && !Array.isArray(obj.questions)) {
        throw new Error("Le JSON doit contenir un champ 'questions' (array).");
      }
      // validation minimale questions/choices
      for (const q of obj.questions || []) {
        if (!q.text || !Array.isArray(q.choices)) {
          throw new Error("Chaque question doit avoir 'text' et un array 'choices'.");
        }
      }
      return {
        description: obj.description ?? null,
        questions: obj.questions ?? []
      };
    }catch(e){
      throw new Error("JSON invalide : " + e.message);
    }
  }

  async function submit(){
    if(!title || !slug) return onDone(false,"Titre et slug requis");
    let extra;
    try{
      extra = parseJsonOrFail();
    }catch(e){
      return onDone(false, e.message);
    }

    setLoading(true);
    const body={
      title,
      slug,
      visibility, // must be 'PUBLIC' or 'PLUS'
      difficulty, // 'EASY' | 'MEDIUM' | 'HARD'
      isDraft,
      description: extra?.description || null,
      // si pas en JSON, on envoie une question démo
      questions: extra?.questions || [
        {
          text:"Une action cotée en EUR à 10,00€ double de prix. Sa performance est de ?",
          kind:"SINGLE",
          choices:[
            { text:"+10%", isCorrect:false },
            { text:"+50%", isCorrect:false },
            { text:"+100%", isCorrect:true }
          ],
          explanation:"Passer de 10 à 20 = +100%."
        }
      ]
    };

    try{
      const r=await fetch("/api/admin/quizzes",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(body)
      });
      const ok=r.ok;
      const j=await r.json().catch(()=> ({}));
      onDone(ok, ok ? "Créé ✅" : (j?.error || "Erreur création"));
    }catch(e){
      onDone(false, "Erreur création (réseau)");
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="glass p-4">
      <h2 className="font-semibold">Créer un quiz</h2>

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

      {/* Avancé (JSON) */}
      <div className="mt-4 p-3 rounded-xl bg-base-200/50 border border-white/10">
        <label className="label cursor-pointer gap-2">
          <input type="checkbox" className="checkbox checkbox-sm" checked={useJson} onChange={()=>setUseJson(v=>!v)} />
          <span>Mode avancé (coller un JSON de questions)</span>
        </label>

        {useJson && (
          <>
            <p className="text-sm opacity-70 mt-1">
              Structure attendue :
              <code> {"{ description?: string, questions: [{ text, kind:'SINGLE'|'MULTI', explanation?, choices:[{ text, isCorrect }] }] }"} </code>
            </p>
            <textarea
              className="textarea textarea-bordered w-full mt-2 min-h-[220px] font-mono text-sm"
              value={jsonText}
              onChange={(e)=>setJsonText(e.target.value)}
            />
          </>
        )}
      </div>

      <button className={`btn btn-primary mt-3 ${loading?"btn-disabled":""}`} onClick={submit}>
        {loading? "…" : "Créer"}
      </button>
    </div>
  );
}