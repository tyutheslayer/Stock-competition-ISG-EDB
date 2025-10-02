// pages/admin/sheets.jsx
import { useState } from "react";
import NavBar from "../../components/NavBar";

export default function AdminSheets() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!file) return setMsg("Choisis un PDF d’abord.");
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);

      const r = await fetch("/api/admin/sheets/upload", { method: "POST", body: fd });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) return setMsg(`❌ ${j?.error || "Upload échoué"}`);
      setMsg("✅ Fiche importée");
      setFile(null); setTitle("");
    } catch {
      setMsg("❌ Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <NavBar />
      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Admin — Ajouter une fiche</h1>
        <form onSubmit={upload} className="space-y-4">
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Titre de la fiche"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e)=>setFile(e.target.files?.[0] || null)}
            className="file-input file-input-bordered w-full"
          />
          <button className={`btn btn-primary ${busy ? "btn-disabled" : ""}`}>
            {busy ? "…" : "Uploader"}
          </button>
        </form>
        {msg && <div className="mt-3">{msg}</div>}
      </main>
    </div>
  );
}