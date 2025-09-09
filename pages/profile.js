import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("USER");
  const [lastChange, setLastChange] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/user/profile");
        if (r.ok) {
          const u = await r.json();
          setName(u?.name ?? "");
          setEmail(u?.email ?? "");
          setRole(u?.role ?? "USER");
          setLastChange(u?.lastNameChangeAt ? new Date(u.lastNameChangeAt) : null);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  function remainingDays() {
    if (role === "ADMIN") return 0; // ⚡️ Pas de limite pour admin
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
      body: JSON.stringify({ name })
    });
    if (r.ok) {
      const u = await r.json();
      setLastChange(u?.lastNameChangeAt ? new Date(u.lastNameChangeAt) : new Date());
      setRole(u?.role ?? "USER");
      setMsg("✅ Profil mis à jour.");
    } else if (r.status === 429) {
      const d = await r.json();
      setMsg(`❌ Trop tôt. Réessaie dans ${d.remainingDays} jour(s).`);
    } else {
      setMsg("❌ Erreur de mise à jour.");
    }
  }

  const days = remainingDays();
  const disabled = days > 0;

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
                  <span className={`badge ${role === "ADMIN" ? "badge-success" : ""}`}>{role}</span>
                </div>
              </div>
              <div className="mb-1">
                <label className="block text-sm mb-1">Nom affiché</label>
                <input className="input input-bordered w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Prénom Nom ou pseudo" />
              </div>
              {role !== "ADMIN" && days > 0 && (
                <p className="text-xs opacity-70 mb-3">Prochain changement possible dans {days} jour(s).</p>
              )}
              <button
                className={`btn w-full ${disabled && role!=="ADMIN" ? "btn-disabled" : "bg-primary text-white"}`}
                onClick={save}
                disabled={disabled && role!=="ADMIN"}
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
