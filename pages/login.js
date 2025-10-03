// pages/login.js
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import PageShell from "../components/PageShell";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    await signIn("credentials", { email, password, callbackUrl: "/" });
  }

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold">Connexion</h1>

        <div className="mt-6 w-full max-w-md rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 text-left">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                className="input input-bordered w-full"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1" htmlFor="password">Mot de passe</label>
              <input
                id="password"
                className="input input-bordered w-full"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button className="btn btn-primary w-full" type="submit">
              Se connecter
            </button>
          </form>

          <div className="divider my-6">ou</div>

          <p className="text-sm mb-2 text-center opacity-80">
            Aucun compte ? Le bouton Google créera automatiquement un compte pour vous.
          </p>
          <button
            className="btn w-full"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            type="button"
          >
            Continuer avec Google
          </button>

          <p className="mt-4 text-sm text-center">
            <a href="/reset" className="link link-primary">Mot de passe oublié ?</a>
          </p>
        </div>
      </main>
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (session) return { redirect: { destination: "/" } };
  return { props: {} };
}