import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/user/profile");
        if (r.ok) {
          const u = await r.json();
          setName(u?.name ?? "");
          setEmail(u?.email ?? "");
        }
      } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setMsg("");
    const r = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    setMsg(r.ok ? "✅ Profil mis à jour." : "❌ Erreur de mise à jour.");
  }

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Mon profil</h1>
        <div className="mt-6 w-full max-w-md p-6 rounded-2xl shadow bg-base-100 text-left">
          {loading ? <div className="skeleton h-24 w-full"></div> : (
            <>
              <div className="mb-3">
                <label className="block text-sm mb-1">Email</label>
                <input className="input input-bordered w-full" value={email} disabled />
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">Nom affiché</label>
                <input className="input input-bordered w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Prénom Nom ou pseudo" />
              </div>
              <button className="btn bg-primary text-white w-full" onClick={save}>Enregistrer</button>
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
