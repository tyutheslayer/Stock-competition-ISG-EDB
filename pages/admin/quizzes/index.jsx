// pages/admin/quizzes/index.jsx
import { useEffect, useState } from "react";
import PageShell from "../../../components/PageShell";

export default function AdminQuizzes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/quizzes");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Erreur API");
      setRows(Array.isArray(j) ? j : []);
    } catch (e) {
      setMsg(`Erreur de chargement — ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onDelete(id, title) {
    if (!id) return;
    if (!confirm(`Supprimer le quiz « ${title} » ?`)) return;
    setMsg("");
    try {
      const r = await fetch(`/api/admin/quizzes/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "DELETE_FAILED");
      setMsg("Quiz supprimé ✅");
      load();
    } catch (e) {
      setMsg(`Suppression échouée — ${e.message || e}`);
    }
  }

  return (
    <PageShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Quizzes (admin)</h1>
          <a href="/admin" className="btn btn-ghost btn-sm">← Retour admin</a>
        </div>

        <QuickCreate onDone={(ok, m) => { setMsg(m || ""); if (ok) load(); }} />
        <ImportFromJSON onDone={(ok, m) => { setMsg(m || ""); if (ok) load(); }} />

        {msg && <div className="alert alert-info my-3"><span>{msg}</span></div>}

        {loading ? (
          <div>Chargement…</div>
        ) : (
          <div className="overflow-x-auto glass mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Slug</th>
                  <th>Visibilité</th>
                  <th>Diff.</th>
                  <th>Q</th>
                  <th>Attempts</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.slug}</td>
                    <td>{r.visibility}</td>
                    <td>{r.difficulty}</td>
                    <td>{r._count?.questions || 0}</td>
                    <td>{r._count?.attempts || 0}</td>
                    <td>{r.isDraft ? "Brouillon" : "Publié"}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-error btn-xs"
                        onClick={() => onDelete(r.id, r.title)}
                        title="Supprimer ce quiz"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="opacity-70">
                      Aucun quiz pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </PageShell>
  );
}

function QuickCreate({ onDone }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [difficulty, setDifficulty] = useState("EASY");
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title || !slug) return onDone(false, "Titre et slug requis");
    setLoading(true);
    try {
      const body = {
        title, slug, visibility, difficulty, isDraft,
        questions: [
          {
            text: "Une action cotée en EUR à 10,00€ double de prix. Sa performance est de ?",
            kind: "SINGLE",
            choices: [
              { text: "+10%", isCorrect: false },
              { text: "+50%", isCorrect: false },
              { text: "+100%", isCorrect: true },
            ],
            explanation: "Passer de 10 à 20 = +100%.",
          },
        ],
      };
      const r = await fetch("/api/admin/quizzes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Création échouée");
      setTitle(""); setSlug(""); setVisibility("PUBLIC"); setDifficulty("EASY"); setIsDraft(false);
      onDone(true, "Créé ✅");
    } catch (e) {
      onDone(false, e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass p-4">
      <h2 className="font-semibold">Créer un quiz rapide</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <input className="input input-bordered" placeholder="Titre" value={title} onChange={(e)=>setTitle(e.target.value)} />
        <input className="input input-bordered" placeholder="slug-ex: bases-actions" value={slug} onChange={(e)=>setSlug(e.target.value)} />
        <select className="select select-bordered" value={visibility} onChange={(e)=>setVisibility(e.target.value)}>
          <option value="PUBLIC">PUBLIC</option>
          <option value="PLUS">PLUS</option>
        </select>
        <select className="select select-bordered" value={difficulty} onChange={(e)=>setDifficulty(e.target.value)}>
          <option value="EASY">EASY</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HARD">HARD</option>
        </select>
        <label className="label cursor-pointer gap-2">
          <span>Brouillon</span>
          <input type="checkbox" className="toggle" checked={isDraft} onChange={()=>setIsDraft(v=>!v)} />
        </label>
      </div>
      <button className={`btn btn-primary mt-3 ${loading ? "btn-disabled" : ""}`} onClick={submit}>
        {loading ? "…" : "Créer"}
      </button>
    </div>
  );
}

function ImportFromJSON({ onDone }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!text.trim()) return onDone(false, "Colle un JSON valide.");
    setLoading(true);
    try {
      let payload = JSON.parse(text);
      const items = Array.isArray(payload) ? payload : [payload];

      // Validation très simple
      for (const it of items) {
        if (!it.title || !it.slug) throw new Error("Chaque quiz doit avoir {title, slug}");
        if (!Array.isArray(it.questions) || it.questions.length === 0) {
          throw new Error(`Le quiz "${it.title}" n'a pas de questions.`);
        }
      }

      // Envoi séquentiel pour des messages clairs
      let okCount = 0;
      for (const it of items) {
        const r = await fetch("/api/admin/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(it),
        });
        if (r.ok) okCount++;
        else {
          const j = await r.json().catch(()=> ({}));
          throw new Error(`Échec "${it.title}" — ${j?.error || r.status}`);
        }
      }

      setText("");
      onDone(true, `Import terminé ✅ (${okCount}/${items.length})`);
    } catch (e) {
      onDone(false, e.message || "Import échoué");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass p-4 mt-4">
      <h2 className="font-semibold">Créer depuis JSON</h2>
      <p className="text-sm opacity-70 mt-1">
        Colle ici un objet ou un tableau d’objets quiz. Champs requis : <code>title</code>, <code>slug</code>, <code>questions[]</code>.
      </p>
      <textarea
        className="textarea textarea-bordered w-full mt-3 min-h-[180px] font-mono text-sm"
        placeholder='[{ "title":"...", "slug":"...", "questions":[ ... ] }]'
        value={text}
        onChange={(e)=>setText(e.target.value)}
      />
      <div className="mt-2">
        <button className={`btn btn-primary ${loading?"btn-disabled":""}`} onClick={submit}>
          {loading ? "…" : "Importer"}
        </button>
      </div>
    </div>
  );
}