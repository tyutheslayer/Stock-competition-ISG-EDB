// pages/admin/quizzes/index.jsx
import { getSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../../components/PageShell";

const EMPTY = {
  id: null,
  title: "",
  slug: "",
  description: "",
  visibility: "PUBLIC", // PUBLIC | PLUS
  topic: "",
  difficulty: "EASY",   // EASY | MEDIUM | HARD
  timeLimitSec: 300,
  isRandomOrder: true,
  questions: [],
};

function sampleQuestions() {
  return [
    {
      text: "Exemple : quel est l'objectif de l'EDB ?",
      kind: "SINGLE", // SINGLE | MULTI | TRUE_FALSE
      explanation: "Simuler pour apprendre sans risque.",
      choices: [
        { text: "Gagner de l'argent réel", isCorrect: false },
        { text: "Apprendre en simulant", isCorrect: true }
      ]
    }
  ];
}

export default function AdminQuizzesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [qJson, setQJson] = useState(JSON.stringify(sampleQuestions(), null, 2));
  const [msg, setMsg] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const r = await fetch("/api/quizzes?all=1");
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  function resetForm() {
    setForm({ ...EMPTY });
    setQJson(JSON.stringify(sampleQuestions(), null, 2));
    setMsg("");
  }

  // validation légère
  const questionsValid = useMemo(() => {
    try {
      const parsed = JSON.parse(qJson);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }, [qJson]);

  async function onSave(e) {
    e.preventDefault();
    setMsg("");
    // parse questions
    let questions;
    try {
      questions = JSON.parse(qJson);
      if (!Array.isArray(questions) || questions.length === 0) {
        setMsg("Le JSON de questions doit être un tableau non vide.");
        return;
      }
    } catch (err) {
      setMsg("JSON de questions invalide.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || "",
      visibility: form.visibility || "PUBLIC",
      topic: form.topic?.trim() || "",
      difficulty: form.difficulty || "EASY",
      timeLimitSec: Number(form.timeLimitSec || 0) || 0,
      isRandomOrder: !!form.isRandomOrder,
      questions,
    };

    if (!payload.title || !payload.slug) {
      setMsg("Titre et slug sont requis.");
      return;
    }

    try {
      const url = form.id ? `/api/quizzes/${encodeURIComponent(form.id)}` : "/api/quizzes";
      const method = form.id ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || "Erreur lors de l’enregistrement.");
        return;
      }
      setMsg("✅ Quiz enregistré.");
      await fetchAll();
      // on garde le formulaire rempli si c'était une édition
      if (!form.id) resetForm();
    } catch (e) {
      setMsg("Erreur réseau.");
    }
  }

  function onEdit(qz) {
    setForm({
      id: qz.id,
      title: qz.title || "",
      slug: qz.slug || "",
      description: qz.description || "",
      visibility: qz.visibility || "PUBLIC",
      topic: qz.topic || "",
      difficulty: qz.difficulty || "EASY",
      timeLimitSec: qz.timeLimitSec || 0,
      isRandomOrder: !!qz.isRandomOrder,
      questions: qz.questions || [],
    });
    setQJson(JSON.stringify(qz.questions || [], null, 2));
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(qz) {
    if (!confirm(`Supprimer le quiz “${qz.title}” ?`)) return;
    try {
      const r = await fetch(`/api/quizzes/${encodeURIComponent(qz.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      await fetchAll();
      if (form.id === qz.id) resetForm();
    } catch {
      alert("Suppression impossible.");
    }
  }

  function exportJSON(qz) {
    const blob = new Blob([JSON.stringify(qz, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${qz.slug || "quiz"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        <h1 className="text-3xl font-bold mb-4">Admin · Quizzes</h1>

        {/* Formulaire */}
        <form onSubmit={onSave} className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-4 md:p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="form-control">
              <span className="label-text">Titre</span>
              <input className="input input-bordered" value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))} required />
            </label>
            <label className="form-control">
              <span className="label-text">Slug</span>
              <input className="input input-bordered" value={form.slug} onChange={(e)=>setForm(f=>({...f,slug:e.target.value.replace(/\s+/g,'-').toLowerCase()}))} required />
            </label>
            <label className="form-control md:col-span-2">
              <span className="label-text">Description</span>
              <input className="input input-bordered" value={form.description} onChange={(e)=>setForm(f=>({...f,description:e.target.value}))} />
            </label>
            <label className="form-control">
              <span className="label-text">Visibilité</span>
              <select className="select select-bordered" value={form.visibility} onChange={(e)=>setForm(f=>({...f,visibility:e.target.value}))}>
                <option value="PUBLIC">PUBLIC</option>
                <option value="PLUS">PLUS (réservé EDB Plus)</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Thème (topic)</span>
              <input className="input input-bordered" value={form.topic} onChange={(e)=>setForm(f=>({...f,topic:e.target.value}))} />
            </label>
            <label className="form-control">
              <span className="label-text">Difficulté</span>
              <select className="select select-bordered" value={form.difficulty} onChange={(e)=>setForm(f=>({...f,difficulty:e.target.value}))}>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Durée (sec)</span>
              <input className="input input-bordered" type="number" min="0" value={form.timeLimitSec} onChange={(e)=>setForm(f=>({...f,timeLimitSec:Number(e.target.value)}))} />
            </label>
            <label className="form-control">
              <span className="label-text">Ordre aléatoire</span>
              <input type="checkbox" className="toggle mt-2" checked={form.isRandomOrder} onChange={(e)=>setForm(f=>({...f,isRandomOrder:e.target.checked}))} />
            </label>
            <label className="form-control md:col-span-2">
              <span className="label-text">Questions (JSON)</span>
              <textarea
                className={`textarea textarea-bordered font-mono min-h-[220px] ${questionsValid?"":"textarea-error"}`}
                value={qJson}
                onChange={(e)=>setQJson(e.target.value)}
                spellCheck={false}
              />
              <span className="label-text-alt mt-1">
                Doit être un tableau : <code>[&#123; text, kind, choices:[&#123;text,isCorrect&#125;] &#125;]</code>
              </span>
            </label>
          </div>

          {msg && (
            <div className={`alert ${msg.startsWith("✅") ? "alert-success" : "alert-warning"} mt-4`}>
              <span>{msg}</span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={!questionsValid}>
              {form.id ? "Mettre à jour" : "Créer le quiz"}
            </button>
            <button className="btn btn-outline" type="button" onClick={resetForm}>Réinitialiser</button>
            {form.id && (
              <span className="opacity-70 text-sm self-center">ID : {form.id}</span>
            )}
          </div>
        </form>

        {/* Liste */}
        <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Quizzes existants</h2>
            <button className="btn btn-sm btn-outline" onClick={fetchAll} disabled={loading}>
              {loading ? "…" : "Rafraîchir"}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="opacity-70">Aucun quiz.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Slug</th>
                    <th>Visibilité</th>
                    <th>Questions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((qz) => (
                    <tr key={qz.id}>
                      <td className="font-medium">{qz.title}</td>
                      <td><code>{qz.slug}</code></td>
                      <td>{qz.visibility}</td>
                      <td>{qz.questions?.length ?? 0}</td>
                      <td className="flex gap-2">
                        <button className="btn btn-xs" onClick={()=>onEdit(qz)}>Éditer</button>
                        <button className="btn btn-xs btn-outline" onClick={()=>exportJSON(qz)}>Exporter JSON</button>
                        <button className="btn btn-xs btn-error" onClick={()=>onDelete(qz)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}

// 🔒 Garde serveur : uniquement ADMIN
export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  const role = session?.user?.role || session?.user?.isAdmin ? "ADMIN" : "USER";
  if (!session || role !== "ADMIN") {
    return { redirect: { destination: "/login" } };
  }
  return { props: {} };
}