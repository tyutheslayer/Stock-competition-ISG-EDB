// pages/admin/index.js
import { getSession } from "next-auth/react";
import NavBar from "../../components/NavBar";
import prisma from "../../lib/prisma";
import { useEffect, useState, useCallback } from "react";

// ---- Panneau des frais de trading ----
function AdminTradingFees({ initialSettings }) {
  const [bps, setBps] = useState(Number(initialSettings?.tradingFeeBps ?? 0));
  const [updatedAt, setUpdatedAt] = useState(initialSettings?.updatedAt || null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeeBps: Number(bps) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setBps(Number(j?.tradingFeeBps ?? 0));
      setUpdatedAt(j?.updatedAt || null);
      setMsg({ ok: true, text: "Frais mis à jour" });
    } catch {
      setMsg({ ok: false, text: "Échec mise à jour" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl shadow bg-base-100 p-4 mb-6">
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
          />
        </label>
        <div className="text-sm opacity-70">
          {(Number(bps) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%
          {updatedAt ? ` • Dernière maj: ${new Date(updatedAt).toLocaleString("fr-FR")}` : ""}
        </div>
        <button className="btn btn-outline" onClick={() => setBps(0)} disabled={saving}>
          Remettre à 0
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
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

export default function Admin({ settings }) {
  const [users, setUsers] = useState([]);
  const [resetAmount, setResetAmount] = useState(100000);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [demoteEmail, setDemoteEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [msg, setMsg] = useState("");

  // === États / handlers pour les Fiches synthèse ===
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetMsg, setSheetMsg] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);

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

  // === Sélection/validation fichier ===
  function onFilePicked(f) {
    if (!f) { setFile(null); setSheetMsg("Aucun fichier sélectionné"); return; }
    if (f.type !== "application/pdf") { setFile(null); setSheetMsg("Le fichier doit être un PDF"); return; }
    if (f.size <= 0) { setFile(null); setSheetMsg("Le fichier est vide (0 octet)"); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    setSheetMsg("");
  }

  // === Upload unique (garde-fous inclus) ===
  async function upload(e) {
    e?.preventDefault?.();
    if (!file) { setSheetMsg("Choisis ou dépose un PDF."); return; }
    if (file.size <= 0) { setSheetMsg("Le fichier est vide (0 octet)."); return; }

    setBusy(true); setSheetMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file); // le champ doit s’appeler "file"
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

  // === Drag & Drop PDF ===
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    onFilePicked(f || null);
  }

  return (
    <div>
      <NavBar />
      <div className="page py-6">
        <h2 className="text-2xl font-semibold text-center">Admin</h2>

        {/* ⚙️ Frais de trading */}
        <div className="mt-6">
          <AdminTradingFees initialSettings={settings} />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl shadow bg-base-100">
            <h3 className="text-lg font-medium">Réinitialiser la saison</h3>
            <div className="mt-3 flex gap-2 items-center">
              <input
                className="input input-bordered w-40"
                type="number"
                value={resetAmount}
                onChange={(e) => setResetAmount(e.target.value)}
              />
              <button className="btn bg-primary text-white" onClick={resetSeason}>
                Reset
              </button>
            </div>
          </div>

            <div className="p-5 rounded-2xl shadow bg-base-100">
              <h3 className="text-lg font-medium">Gestion des rôles</h3>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    className="input input-bordered flex-1"
                    placeholder="email à promouvoir"
                    value={promoteEmail}
                    onChange={(e) => setPromoteEmail(e.target.value)}
                  />
                  <button className="btn" onClick={() => setRole(promoteEmail, "ADMIN")}>
                    Promouvoir ADMIN
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input input-bordered flex-1"
                    placeholder="email à rétrograder"
                    value={demoteEmail}
                    onChange={(e) => setDemoteEmail(e.target.value)}
                  />
                  <button className="btn" onClick={() => setRole(demoteEmail, "USER")}>
                    Rétrograder USER
                  </button>
                </div>
              </div>
            </div>

          <div className="p-5 rounded-2xl shadow bg-base-100 md:col-span-2">
            <h3 className="text-lg font-medium">Supprimer un utilisateur</h3>
            <div className="mt-3 flex gap-2">
              <input
                className="input input-bordered flex-1"
                placeholder="email à supprimer"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
              />
              <button className="btn btn-error" onClick={() => deleteUser(deleteEmail)}>
                Supprimer
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Section Fiches synthèse — Import + Liste */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl shadow bg-base-100">
            <h3 className="text-lg font-medium mb-3">Fiches synthèse — Import PDF</h3>

            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                dragOver ? "border-primary bg-base-200/60" : "border-base-300"
              }`}
              onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
              onDragLeave={(e)=>{e.preventDefault(); setDragOver(false);}}
              onDrop={onDrop}
            >
              <p className="mb-2">Glisse ton PDF ici</p>
              <p className="opacity-60 text-sm">ou</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <input
                  type="file"
                  accept="application/pdf"
                  className="file-input file-input-bordered"
                  onChange={(e)=>onFilePicked(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Titre de la fiche"
                value={title}
                onChange={(e)=>setTitle(e.target.value)}
              />
              <button className={`btn btn-primary ${busy ? "btn-disabled" : ""}`} onClick={upload} disabled={!file || busy}>
                {busy ? "…" : "Uploader"}
              </button>

              {file && <div className="text-sm">Fichier prêt : <b>{file.name}</b></div>}
              {sheetMsg && <div className="mt-1">{sheetMsg}</div>}
            </div>
          </div>

          <div className="p-5 rounded-2xl shadow bg-base-100">
            <h3 className="text-lg font-medium mb-3">Fiches disponibles</h3>
            {sheets.length === 0 ? (
              <div className="opacity-60">Aucune fiche pour le moment.</div>
            ) : (
              <ul className="space-y-3">
                {sheets.map((s) => (
                  <li key={s.id || s.key || s.url} className="p-3 bg-base-200/40 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.title || s.name || "Sans titre"}</div>
                      <div className="text-xs opacity-60">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : ""}
                      </div>
                    </div>
                    <a className="btn btn-outline btn-sm" href={s.url} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 p-5 rounded-2xl shadow bg-base-100">
          <h3 className="text-lg font-medium mb-2">Utilisateurs</h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Cash</th>
                  <th>Equity (approx)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email}>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.cash?.toFixed(2)}</td>
                    <td>{u.equity?.toFixed?.(2) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {msg && <p className="mt-4 text-center">{msg}</p>}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== "ADMIN") {
    return { redirect: { destination: "/", permanent: false } };
  }

  // Charger les settings côté serveur pour hydrater le panneau
  let settings = null;
  try {
    const s = await prisma.settings.findFirst({
      select: { tradingFeeBps: true, updatedAt: true },
    });
    if (s) {
      settings = {
        tradingFeeBps: s.tradingFeeBps,
        updatedAt: s.updatedAt?.toISOString?.() || null,
      };
    }
  } catch {
    settings = null;
  }

  return { props: { settings } };
}