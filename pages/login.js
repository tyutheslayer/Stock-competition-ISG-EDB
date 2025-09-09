import { getSession, signIn } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    await signIn("credentials", { email, password, callbackUrl: "/" });
  }

  return (
    <div>
      <NavBar />
      <main className="page py-10 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Connexion</h1>

        <div className="mt-6 w-full max-w-md p-6 rounded-2xl shadow bg-base-100 text-left">
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input className="input input-bordered w-full" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Mot de passe</label>
              <input className="input input-bordered w-full" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <button className="btn bg-primary text-white w-full" type="submit">Se connecter</button>
          </form>

          <div className="divider">ou</div>

          <p className="text-sm mb-2 text-center opacity-80">Aucun compte ? Le bouton Google créera automatiquement un compte pour vous.</p>
          <button className="btn w-full" onClick={() => signIn("google", { callbackUrl: "/" })}>
            Continuer avec Google
          </button>
        </div>
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (session) return { redirect: { destination: "/" } };
  return { props: {} };
}
