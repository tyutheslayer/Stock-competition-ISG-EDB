import { useState } from "react";
import NavBar from "../../components/NavBar";

export default function AdminSheets() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState(null);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    const r = await fetch("/api/admin/sheets/upload", { method:"POST", body:fd });
    const j = await r.json();
    if (!r.ok) return setMsg(`❌ ${j.error}`);
    setMsg("✅ Fiche ajoutée");
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
            onChange={(e)=>setFile(e.target.files[0])}
            className="file-input file-input-bordered w-full"
          />
          <button className="btn btn-primary">Uploader</button>
        </form>
        {msg && <div className="mt-3">{msg}</div>}
      </main>
    </div>
  );
}