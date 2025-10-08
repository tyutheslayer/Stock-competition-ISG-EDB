// pages/register.js
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../components/PageShell";

/* ===== Date d'ouverture : Jeudi 9 Octobre 2025 12:00 heure de Paris =====
   Paris = UTC+2 à cette date → équivaut à 10:00 UTC (Z) */
const OPENING_UTC_ISO = "2025-10-09T10:00:00Z"; // immuable et universel

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const openAt = useMemo(() => new Date(OPENING_UTC_ISO), []);
  const [now, setNow] = useState(() => new Date());
  const blocked = now.getTime() < openAt.getTime();

  // mise à jour du temps toutes les secondes
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // temps restant
  const remaining = useMemo(() => {
    const diff = Math.max(0, openAt.getTime() - now.getTime());
    const total = Math.floor(diff / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return { d, h, m, s };
  }, [now, openAt]);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email.trim()), [email]);

  const pwdScore = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);
  const pwdLabel = ["Très faible", "Faible", "Moyenne", "Forte", "Très forte"][pwdScore];

  async function onSubmit(e) {
    e.preventDefault();
    if (blocked) return;
    setMsg({ type: "", text: "" });

    if (!emailValid) {
      setMsg({ type: "error", text: "Merci d’indiquer un email valide." });
      return;
    }
    if (password.length < 8) {
      setMsg({ type: "error", text: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, email: email.trim(), password }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg({ type: "success", text: "Compte créé ✅ Redirection vers la connexion…" });
      setTimeout(() => router.push("/login?registered=1"), 800);
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Erreur inconnue" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold">Créer un compte</h1>
        <p className="opacity-70 mt-1">
          Rejoins l’École de la Bourse pour accéder aux mini-cours, au simulateur et au classement.
        </p>

        {/* 🔒 avant ouverture */}
        {blocked && (
          <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 mt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔒</div>
              <div>
                <div className="font-semibold">
                  Les inscriptions ouvrent le jeudi 9 octobre 2025 à 12:00 (heure de Paris)
                </div>
                <div className="mt-3 text-lg font-mono">
                  {remaining.d > 0 && <span>{remaining.d}j </span>}
                  {String(remaining.h).padStart(2, "0")}:
                  {String(remaining.m).padStart(2, "0")}:
                  {String(remaining.s).padStart(2, "0")}
                </div>
                <div className="mt-3 text-sm opacity-70">
                  (équivaut à {openAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })})
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ après ouverture — reste ouvert définitivement */}
        {!blocked && (
          <>
            <form
              onSubmit={onSubmit}
              className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 mt-6 space-y-4"
            >
              <label className="form-control">
                <span className="label"><span className="label-text">Nom (optionnel)</span></span>
                <input
                  className="input input-bordered"
                  placeholder="Prénom Nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <label className="form-control">
                <span className="label">
                  <span className="label-text">Email</span>
                  {!email || emailValid
                    ? <span className="label-text-alt opacity-60">Utilisé pour te connecter</span>
                    : <span className="label-text-alt text-error">Email invalide</span>}
                </span>
                <input
                  className={`input input-bordered ${email && !emailValid ? "input-error" : ""}`}
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="form-control">
                <span className="label">
                  <span className="label-text">Mot de passe</span>
                  <span className="label-text-alt opacity-60">8+ caractères</span>
                </span>

                <div className="join w-full">
                  <input
                    className="input input-bordered join-item w-full"
                    placeholder="••••••••"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn join-item"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? "Masquer" : "Afficher"}
                  </button>
                </div>

                <div className="mt-2">
                  <progress
                    className={`progress w-full ${
                      pwdScore >= 3 ? "progress-success" : pwdScore >= 2 ? "progress-warning" : "progress-error"
                    }`}
                    value={pwdScore}
                    max="4"
                  />
                  <div className="text-xs opacity-70 mt-1">Robustesse : {pwdLabel}</div>
                </div>
              </label>

              {msg.text && (
                <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"} mt-2`}>
                  <span>{msg.text}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button className={`btn btn-primary ${loading ? "btn-disabled" : ""}`} type="submit">
                  {loading ? <span className="loading loading-spinner loading-sm" /> : "Créer mon compte"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => router.push("/login")}>
                  J’ai déjà un compte
                </button>
              </div>

              <p className="text-xs opacity-60 mt-3">
                En créant un compte, tu acceptes notre charte d’utilisation.
              </p>
            </form>
          </>
        )}
      </main>
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (session) return { redirect: { destination: "/trade" } };
  return { props: {} };
}