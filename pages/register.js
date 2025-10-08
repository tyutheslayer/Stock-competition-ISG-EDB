// pages/register.js
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../components/PageShell";

/* ==== Heures Europe/Paris ==== */
function getParisNow() {
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = paris.getTime() - utc.getTime();
  return new Date(now.getTime() + offset);
}

/* 🆕 Jeudi 12:00 de la semaine courante (peut être dans le passé) */
function thursdayNoonThisWeekParis(ref = getParisNow()) {
  const d = new Date(ref);
  const day = d.getDay(); // 0=dim … 4=jeu
  const diffToThu = 4 - day;
  const t = new Date(d);
  t.setDate(d.getDate() + diffToThu);
  t.setHours(12, 0, 0, 0);
  return t;
}

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // 🛡 Gate inscriptions basé sur l'heure de Paris
  const [nowParis, setNowParis] = useState(() => getParisNow());
  const [openAt] = useState(() => thursdayNoonThisWeekParis()); // figé sur CE jeudi 12:00
  const blocked = nowParis < openAt;

  useEffect(() => {
    if (!blocked) return;
    const id = setInterval(() => setNowParis(getParisNow()), 1000);
    return () => clearInterval(id);
  }, [blocked]);

  const remaining = useMemo(() => {
    const ms = Math.max(0, openAt.getTime() - nowParis.getTime());
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return { d, h, m, s: ss };
  }, [nowParis, openAt]);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email.trim()), [email]);

  // very lightweight score: length + variety
  const pwdScore = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4); // 0..4
  }, [password]);
  const pwdLabel = ["Très faible", "Faible", "Moyenne", "Forte", "Très forte"][pwdScore];

  async function onSubmit(e) {
    e.preventDefault();
    if (blocked) return; // garde-fou UX
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

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Impossible de créer le compte");
      }

      setMsg({ type: "success", text: "Compte créé ✅ Redirection vers la connexion…" });
      setTimeout(() => {
        router.push("/login?registered=1");
      }, 800);
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

        {/* Bloc verrou + compte à rebours */}
        {blocked && (
          <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 mt-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔒</div>
              <div>
                <div className="font-semibold">Les inscriptions ouvrent jeudi à 12h (heure de Paris).</div>
                <div className="opacity-80 text-sm mt-1">
                  Juste après la présentation officielle de l’École de la Bourse.
                </div>
                <div className="mt-3 text-lg font-mono">
                  {remaining.d > 0 && <span>{remaining.d}j </span>}
                  {String(remaining.h).padStart(2, "0")}:
                  {String(remaining.m).padStart(2, "0")}:
                  {String(remaining.s).padStart(2, "0")}
                </div>
                <div className="mt-3 text-sm opacity-70">
                  Ouverture prévue le {openAt.toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire seulement quand c’est ouvert */}
        {!blocked && (
          <>
            <form
              onSubmit={onSubmit}
              className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6 mt-6 space-y-4"
            >
              {/* Nom */}
              <label className="form-control">
                <span className="label">
                  <span className="label-text">Nom (optionnel)</span>
                </span>
                <input
                  className="input input-bordered"
                  placeholder="Prénom Nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              {/* Email */}
              <label className="form-control">
                <span className="label">
                  <span className="label-text">Email</span>
                  {!email || emailValid ? (
                    <span className="label-text-alt opacity-60">Utilisé pour te connecter</span>
                  ) : (
                    <span className="label-text-alt text-error">Email invalide</span>
                  )}
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

              {/* Mot de passe */}
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
                    aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPwd ? "Masquer" : "Afficher"}
                  </button>
                </div>

                {/* strength bar */}
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

              {/* Messages */}
              {msg.text && (
                <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"} mt-2`}>
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button className={`btn btn-primary ${loading ? "btn-disabled" : ""}`} type="submit">
                  {loading ? <span className="loading loading-spinner loading-sm" /> : "Créer mon compte"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => router.push("/login")}>
                  J’ai déjà un compte
                </button>
              </div>

              <p className="text-xs opacity-60 mt-3">
                En créant un compte, tu acceptes notre charte d’utilisation. Tu pourras supprimer ton compte à tout moment.
              </p>
            </form>

            <div className="mt-6 text-sm opacity-70">
              Un compte de démonstration existe aussi&nbsp;: <code>demo@example.com</code> / <code>demo1234</code> (si le seed a été exécuté).
            </div>
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