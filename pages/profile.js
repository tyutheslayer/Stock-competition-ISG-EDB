import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <PlusThemeProvider>
      <Component {...pageProps} />
    </PlusThemeProvider>
  );
}
const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];

export default function Profile() {
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [promo, setPromo] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("USER");
  const [isAdmin, setIsAdmin] = useState(false); // 👈 nouveau
  const [lastChange, setLastChange] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/user/profile");
        if (r.ok) {
          const u = await r.json();
          setName(u?.name ?? "");
          setPromo(u?.promo ?? "");
          setEmail(u?.email ?? "");
          setRole(u?.role ?? "USER");
          setIsAdmin(!!u?.isAdmin || u?.role === "ADMIN"); // 👈 badge fiable
          setLastChange(u?.lastNameChangeAt ? new Date(u.lastNameChangeAt) : null);
        } else {
          // remonte l'erreur serveur si dispo
          let eTxt = "❌ Impossible de charger le profil.";
          try { const e = await r.json(); if (e?.error) eTxt = `❌ ${e.error}`; } catch {}
          setMsg(eTxt);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  function remainingDays() {
    if (isAdmin || role === "ADMIN") return 0; // pas de limite pour admin
    if (!lastChange) return 0;
    const elapsed = Date.now() - lastChange.getTime();
    const remainingMs = 15*24*60*60*1000 - elapsed;
    return remainingMs > 0 ? Math.ceil(remainingMs / (24*60*60*1000)) : 0;
  }

  async function save() {
    setMsg("");
    const r = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, promo })
    });

    if (r.ok) {
      const u = await r.json();
      setLastChange(u?.lastNameChangeAt ? new Date(u.lastNameChangeAt) : new Date());
      setRole(u?.role ?? "USER");
      setIsAdmin(!!u?.isAdmin || u?.role === "ADMIN"); // 👈 met à jour localement
      setPromo(u?.promo ?? promo); // garde la valeur renvoyée par l’API
      setMsg("✅ Profil mis à jour.");
    } else if (r.status === 429) {
      const d = await r.json();
      setMsg(`❌ Trop tôt. Réessaie dans ${d.remainingDays} jour(s).`);
    } else {
      let eTxt = "❌ Erreur de mise à jour.";
      try {
        const e = await r.json();
        if (e?.error) eTxt = `❌ ${e.error}`; // ex: "Promo invalide"
      } catch {}
      setMsg(eTxt);
    }
  }

  const days = remainingDays();
  const disabled = days > 0 && !(isAdmin || role === "ADMIN");

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Mon profil</h1>
        <div className="mt-6 w-full max-w-md p-6 rounded-2xl shadow bg-base-100 text-left">
          {loading ? <div className="skeleton h-24 w-full"></div> : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="w-full">
                  <label className="block text-sm mb-1">Email</label>
                  <input className="input input-bordered w-full" value={email} disabled />
                </div>
                <div className="ml-3">
                  <span className={`badge ${(isAdmin || role === "ADMIN") ? "badge-success" : ""}`}>
                    {(isAdmin || role === "ADMIN") ? "ADMIN" : "USER"}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm mb-1">Nom affiché</label>
                <input
                  className="input input-bordered w-full"
                  value={name}
                  onChange={e=>setName(e.target.value)}
                  placeholder="Prénom Nom ou pseudo"
                />
                {!isAdmin && role !== "ADMIN" && days > 0 && (
                  <p className="text-xs opacity-70 mt-1">Prochain changement possible dans {days} jour(s).</p>
                )}
              </div>

              {/* --- Promo (liste limitée) --- */}
              <div className="mb-4">
                <label className="block text-sm mb-1">Promo</label>
                <select
                  className="select select-bordered w-full"
                  value={promo}
                  onChange={e=>setPromo(e.target.value)}
                >
                  <option value="">— Sélectionner —</option>
                  {ALLOWED_PROMOS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p className="text-xs opacity-70 mt-1">
                  Choisis ta promo parmi : {ALLOWED_PROMOS.join(", ")}.
                </p>
              </div>

              <button
                className={`btn w-full ${disabled ? "btn-disabled" : "bg-primary text-white"}`}
                onClick={save}
                disabled={disabled}
              >
                Enregistrer
              </button>
              {msg && <p className="mt-3 text-center">{msg}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}