// components/Hero.jsx
import { useState } from "react";
import Link from "next/link";

export default function Hero() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setMsg({ type: "error", text: "Merci de renseigner un email valide." });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/signup/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "hero" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Inscription impossible");
      setMsg({
        type: "success",
        text:
          "Inscription enregistrée ! Tu recevras un rappel chaque jeudi à 12h55 (heure de Paris).",
      });
      setEmail("");
    } catch (err) {
      setMsg({
        type: "error",
        text:
          err?.message ||
          "Une erreur est survenue. Réessaie dans un instant.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-8">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              L’<span className="text-primary">École de la Bourse</span> :
              apprends en simulant, <span className="whitespace-nowrap">progresse sans risque</span>
            </h1>
            <p className="mt-4 text-lg opacity-80">
              Un simulateur simple, un classement motivant, et des{" "}
              <b>mini-cours gratuits chaque jeudi 13h–13h30</b>.
              Passe au plan Pro pour des ateliers, replays, et outils avancés.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {/* Ouvre la modale d'inscription gratuite */}
              <button
                className="btn btn-primary"
                onClick={() => {
                  setMsg({ type: "", text: "" });
                  setOpen(true);
                }}
              >
                Mini-cours gratuit
              </button>

              {/* Plan Pro → /plus */}
              <Link href="/plus" className="btn btn-outline">
                Découvrir la formation +
              </Link>

              <Link href="/calendar" className="btn btn-ghost">
                Calendrier des sessions
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-4 text-sm">
              <div className="badge badge-primary badge-outline">Gratuit</div>
              <div className="badge badge-ghost">Sans CB</div>
              <div className="badge badge-ghost">Ouvert à tous</div>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="rounded-2xl shadow-xl bg-base-100 p-4 md:p-6 border">
              <div className="text-sm opacity-70 mb-2">Aperçu du tableau de bord</div>
              <div className="stats w-full shadow">
                <div className="stat">
                  <div className="stat-title">Valorisation actions</div>
                  <div className="stat-value">€ 42 350</div>
                  <div className="stat-desc">+2,4% aujourd’hui</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Cash</div>
                  <div className="stat-value">€ 57 650</div>
                  <div className="stat-desc">Prêt à investir</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-sm opacity-70">Classement</div>
                  <div className="font-semibold">Top 10</div>
                </div>
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-sm opacity-70">Badges</div>
                  <div className="font-semibold">“Meilleur trade”</div>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/leaderboard" className="link link-primary">
                  Voir le classement →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale d’inscription gratuite */}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">Mini-cours gratuit du jeudi</h3>
            <p className="py-2 text-sm opacity-80">
              Laisse ton email pour recevoir le lien et un rappel
              chaque jeudi à 12h55 (heure de Paris).
            </p>

            <form onSubmit={submit} className="mt-2 space-y-3">
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {msg.text && (
                <div
                  className={`text-sm ${
                    msg.type === "success" ? "text-success" : "text-error"
                  }`}
                >
                  {msg.text}
                </div>
              )}

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button className={`btn btn-primary ${loading ? "btn-disabled" : ""}`}>
                  {loading ? "…" : "S’inscrire"}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
        </div>
      )}
    </section>
  );
}