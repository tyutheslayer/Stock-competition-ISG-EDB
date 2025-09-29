//pages/register.js
import { getSession } from "next-auth/react";
import { useState } from "react";
import NavBar from "../components/NavBar";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (res.ok) setMsg("Compte créé. Vous pouvez vous connecter.");
    else setMsg("Erreur: " + (await res.text()));
  }

  return (
    <div>
      <NavBar />
      <div className="container">
        <h2>Créer un compte</h2>
        <form onSubmit={onSubmit} className="card" style={{ maxWidth: 420 }}>
          <input className="input" placeholder="Nom (optionnel)" value={name} onChange={e => setName(e.target.value)} />
          <div style={{ height: 8 }} />
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <div style={{ height: 8 }} />
          <input className="input" placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <div style={{ height: 8 }} />
          <button className="btn" type="submit">Créer</button>
          {msg && <p>{msg}</p>}
        </form>
        <p>Un compte de démonstration existe aussi : <code>demo@example.com</code> / <code>demo1234</code> (si vous exécutez le seed).</p>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (session) {
    return { redirect: { destination: "/trade" } };
  }
  return { props: {} };
}
