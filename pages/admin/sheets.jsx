// pages/admin/sheets.jsx
import { useState } from "react";
import PageShell from "../../components/PageShell";

export default function AdminSheets() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!file) return setMsg("Choisis un PDF d’abord.");
    setBusy(true);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);

      const r = await fetch("/api/admin/sheets/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(`❌ ${j?.error || "Upload échoué"}`);
      setMsg("✅ Fiche importée");
      setFile(null);
      setTitle("");
    } catch {
      setMsg("❌ Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-center mb-6">Admin — Ajouter une fiche</h1>

        <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6">
          <form onSubmit={upload} className="space-y-4">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Titre de la fiche"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file-input file-input-bordered w-full"
            />
            <button className={`btn btn-primary w-full ${busy ? "btn-disabled" : ""}`}>
              {busy ? "…" : "Uploader"}
            </button>
          </form>

          {msg && (
            <div className="mt-4 text-center">
              <span
                className={
                  msg.startsWith("✅")
                    ? "text-success font-medium"
                    : msg.startsWith("❌")
                    ? "text-error font-medium"
                    : "opacity-80"
                }
              >
                {msg}
              </span>
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}