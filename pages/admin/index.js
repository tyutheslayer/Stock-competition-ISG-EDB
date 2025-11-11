// pages/admin/index.js
import { getSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import PageShell from "../../components/PageShell";

/* --- Bloc frais trading (charge via API côté client) --- */
function AdminTradingFees() {
  const [bps, setBps] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    setMsg(null);
    try {
      const r = await fetch("/api/admin/settings");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Échec chargement settings");
      setBps(Number(j?.tradingFeeBps ?? 0));
      setUpdatedAt(j?.updatedAt || null);
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Erreur settings" });
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeeBps: Math.round(Number(bps || 0)) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || "Échec mise à jour");
      setBps(Number(j?.tradingFeeBps ?? 0));
      setUpdatedAt(j?.updatedAt || null);
      setMsg({ ok: true, text: "Frais mis à jour" });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Erreur mise à jour" });
    } finally {
      setSaving(false);
    }
  }

  const pct = Number.isFinite(Number(bps)) ? (Number(bps) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "—";

  return (
    <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Frais de trading</h2>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="form-control w-48">
          <span className="label-text">Basis points (bps)</span>
          <input
            type="number"
            className="input input-bordered"
            min={0}
            max={10000}
            step={1}
            value={bps}
            onChange={(e) => setBps(e.target.value)}
            disabled={saving}
            inputMode="numeric"
          />
        </label>
        <div className="text-sm opacity-70">
          {pct}%{updatedAt ? ` • Dernière maj: ${new Date(updatedAt).toLocaleString("fr-FR")}` : ""}
        </div>
        <button className="btn btn-outline" onClick={() => setBps(0)} disabled={saving}>
          Remettre à 0
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving || bps === ""}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn btn-ghost" onClick={load} disabled={saving}>
          Recharger
        </button>
      </div>

      {msg && (
        <div className={`alert mt-3 ${msg.ok ? "alert-success" : "alert-error"}`}>
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [resetAmount, setResetAmount] = useState(100000);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [demoteEmail, setDemoteEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [msg, setMsg] = useState("");

  // Fiches synthèse
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetMsg, setSheetMsg] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  async function loadUsers() {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json());
  }
  useEffect(() => { loadUsers(); }, []);

  const loadSheets = useCallback(async () => {
    try {
      const r = await fetch("/api/plus/sheets");
      const j = await r.json();
      setSheets(Array.isArray(j) ? j : []);
      setSelected(new Set());
    } catch {
      setSheets([]);
    }
  }, []);
  useEffect(() => { loadSheets(); }, [loadSheets]);

  async function resetSeason() {
    setMsg("");
    const r = await fetch("/api/admin/reset-season", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startingCash: Number(resetAmount) }),
    });
    setMsg(r.ok ? "Saison réinitialisée." : "Erreur reset.");
    if (r.ok) loadUsers();
  }

  async function setRole(email, role) {
    setMsg("");
    const r = await fetch("/api/admin/user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setMsg(r.ok ? `Rôle mis à jour: ${email} -> ${role}` : "Erreur rôle.");
    if (r.ok) loadUsers();
  }

  async function deleteUser(email) {
    if (!email) return;
    if (!confirm(`Supprimer ${email} ? (positions & ordres supprimés)`)) return;
    const r = await fetch("/api/admin/user/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMsg(r.ok ? `Utilisateur supprimé: ${email}` : "Erreur suppression.");
    if (r.ok) {
      setDeleteEmail("");
      loadUsers();
    }
  }

  function onFilePicked(f) {
    if (!f) { setFile(null); setSheetMsg("Aucun fichier sélectionné"); return; }
    if (f.type !== "application/pdf") { setFile(null); setSheetMsg("Le fichier doit être un PDF"); return; }
    if (f.size <= 0) { setFile(null); setSheetMsg("Le fichier est vide (0 octet)"); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    setSheetMsg("");
  }
  async function upload(e) {
    e?.preventDefault?.();
    if (!file) { setSheetMsg("Choisis ou dépose un PDF."); return; }
    if (file.size <= 0) { setSheetMsg("Le fichier est vide (0 octet)."); return; }

    setBusy(true); setSheetMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || file.name.replace(/\.pdf$/i, ""));

      const r = await fetch("/api/admin/sheets/upload", { method: "POST", body: fd });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) { setSheetMsg(`❌ ${j?.error || "Upload échoué"}`); return; }

      setSheetMsg("✅ Fiche importée");
      setFile(null); setTitle("");
      await loadSheets();
    } catch {
      setSheetMsg("❌ Erreur réseau");
    } finally {
      setBusy(false);
    }
  }
  function onDrop(e) { e.preventDefault(); setDragOver(false); onFilePicked(e.dataTransfer.files?.[0] || null); }
  async function deleteOne(key) {
    if (!key) return;
    if (!confirm("Supprimer cette fiche ?")) return;
    try {
      const r = await fetch(`/api/plus/sheets?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setSheetMsg("✅ Fiche supprimée");
      await loadSheets();
    } catch { setSheetMsg("❌ Suppression échouée"); }
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Supprimer ${selected.size} fiche(s) ?`)) return;
    let ok = 0, ko = 0;
    for (const key of selected) {
      try {
        const r = await fetch(`/api/plus/sheets?key=${encodeURIComponent(key)}`, { method: "DELETE" });
        if (r.ok) ok++; else ko++;
      } catch { ko++; }
    }
    setSheetMsg(ko === 0 ? `✅ ${ok} fiche(s) supprimée(s)` : `⚠️ ${ok} ok, ${ko} échec(s)`);
    await loadSheets();
  }
  function toggleSelect(key) { setSelected(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; }); }
  function selectAll() { setSelected(new Set(sheets.map(s => s.id))); }
  function clearSelection() { setSelected(new Set()); }

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-center">Panneau Admin</h1>

        {/* ⚙️ Frais de trading (via API) */}
        <div className="mt-8">
          <AdminTradingFees />
        </div>

        {/* 🔗 Tuiles rapides */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold">Gestion des quizzes</h3>
            <p className="opacity-70 text-sm mt-1">Créer, lister et supprimer des quizzes.</p>
            <a href="/admin/quizzes" className="btn btn-primary mt-3">Ouvrir les quizzes</a>
          </div>

          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold">Raccourci fiches</h3>
            <p className="opacity-70 text-sm mt-1">Importer et gérer les fiches PDF EDB Plus.</p>
            <a href="#fiches" className="btn btn-outline mt-3">Aller aux fiches</a>
          </div>

          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold">Utilisateurs</h3>
            <p className="opacity-70 text-sm mt-1">Consulter et administrer les comptes.</p>
            <a href="#users" className="btn btn-outline mt-3">Voir la liste</a>
          </div>
        </div>

        {/* Réinitialisation saison + rôles */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold">Réinitialiser la saison</h3>
            <div className="mt-3 flex gap-2 items-center">
              <input className="input input-bordered w-40" type="number" value={resetAmount} onChange={(e) => setResetAmount(e.target.value)} />
              <button className="btn btn-primary" onClick={resetSeason}>Reset</button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold">Gestion des rôles</h3>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input className="input input-bordered flex-1" placeholder="email à promouvoir" value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} />
                <button className="btn btn-outline" onClick={() => setRole(promoteEmail, "ADMIN")}>Promouvoir ADMIN</button>
              </div>
              <div className="flex gap-2">
                <input className="input input-bordered flex-1" placeholder="email à rétrograder" value={demoteEmail} onChange={(e) => setDemoteEmail(e.target.value)} />
                <button className="btn btn-outline" onClick={() => setRole(demoteEmail, "USER")}>Rétrograder USER</button>
              </div>
            </div>
          </div>
        </div>

        {/* Fiches synthèse */}
        <div id="fiches" className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Fiches synthèse — Import PDF</h3>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? "border-primary bg-base-200/60" : "border-base-300"}`}
              onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
              onDragLeave={(e)=>{e.preventDefault(); setDragOver(false);}}
              onDrop={onDrop}
            >
              <p className="mb-2">Glisse ton PDF ici</p>
              <p className="opacity-60 text-sm">ou</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <input type="file" accept="application/pdf" className="file-input file-input-bordered" onChange={(e)=>onFilePicked(e.target.files?.[0] || null)} />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <input type="text" className="input input-bordered w-full" placeholder="Titre de la fiche" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <button className={`btn btn-primary ${busy ? "btn-disabled" : ""}`} onClick={upload} disabled={!file || busy}>
                {busy ? "…" : "Uploader"}
              </button>
              {file && <div className="text-sm">Fichier prêt : <b>{file.name}</b></div>}
              {sheetMsg && <div className="mt-1">{sheetMsg}</div>}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Fiches disponibles</h3>
              <div className="flex items-center gap-2">
                <button className="btn btn-xs btn-outline" onClick={selectAll}>Tout</button>
                <button className="btn btn-xs btn-outline" onClick={clearSelection}>Aucun</button>
                <button className={`btn btn-xs btn-error ${selected.size === 0 ? "btn-disabled" : ""}`} onClick={deleteSelected} disabled={selected.size === 0}>
                  Supprimer la sélection ({selected.size})
                </button>
              </div>
            </div>

            {sheets.length === 0 ? (
              <div className="opacity-60">Aucune fiche pour le moment.</div>
            ) : (
              <ul className="space-y-3">
                {sheets.map((s) => (
                  <li key={s.id || s.key || s.url} className="p-3 bg-base-200/40 rounded-xl grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                    <input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    <div>
                      <div className="font-medium">{s.title || s.name || "Sans titre"}</div>
                      <div className="text-xs opacity-60">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : ""}</div>
                    </div>
                    <a className="btn btn-outline btn-sm" href={s.url} target="_blank" rel="noreferrer">Ouvrir</a>
                    <button className="btn btn-error btn-sm" onClick={() => deleteOne(s.id)}>Supprimer</button>
                  </li>
                ))}
              </ul>
            )}

            {sheetMsg && <div className="mt-3">{sheetMsg}</div>}
          </div>
        </div>

        {/* Liste utilisateurs */}
        <div id="users" className="mt-6 p-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg">
          <h3 className="text-lg font-semibold mb-2">Utilisateurs</h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr><th>Email</th><th>Rôle</th><th>Cash</th><th>Equity (approx)</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email}>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.cash?.toFixed?.(2) ?? "-"}</td>
                    <td>{u.equity?.toFixed?.(2) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {msg && <p className="mt-4 text-center">{msg}</p>}
        </div>
      </main>
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  try {
    const session = await getSession(ctx);
    const role = session?.user?.role;
    if (!session || role !== "ADMIN") {
      return { redirect: { destination: "/", permanent: false } };
    }
    return { props: {} }; // pas d’accès DB en SSR => évite 500
  } catch {
    return { redirect: { destination: "/", permanent: false } };
  }
}