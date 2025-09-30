// pages/reset.js
import { useState } from "react";
import { signIn, getCsrfToken } from "next-auth/react";
import NavBar from "../components/NavBar";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <PlusThemeProvider>
      <Component {...pageProps} />
    </PlusThemeProvider>
  );
}
export default function ResetPage({ csrfToken }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setMsg("Envoi en cours…");
    // Envoie un lien magique via NextAuth EmailProvider
    const res = await signIn("email", { email, redirect: false });
    if (res?.ok) setMsg("✅ Lien envoyé ! Vérifie ta boîte mail.");
    else setMsg("❌ Erreur, réessaie.");
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-md mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Réinitialiser mon mot de passe</h1>
        <form onSubmit={submit} className="bg-base-100 p-6 rounded-2xl shadow text-left">
          <input type="hidden" name="csrfToken" defaultValue={csrfToken} />
          <label className="block text-sm mb-1">Email @isg.fr</label>
          <input
            className="input input-bordered w-full mb-4"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
          <button className="btn bg-primary text-white w-full" type="submit">
            Envoyer un lien magique
          </button>
          {msg && <p className="mt-3 text-center">{msg}</p>}
        </form>
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const csrfToken = await getCsrfToken(ctx);
  return { props: { csrfToken } };
}