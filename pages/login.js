import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import NavBar from "../components/NavBar";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email, password, redirect: true, callbackUrl: "/trade"
    });
    if (res?.error) setError("Identifiants invalides.");
  }

  return (
    <div>
      <NavBar />
      <div className="container">
        <h2>Connexion</h2>
        <form onSubmit={onSubmit} className="card" style={{ maxWidth: 420 }}>
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <div style={{ height: 8 }} />
          <input className="input" placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ height: 8 }} />
          <button className="btn" type="submit">Se connecter</button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </form>
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
