// pages/plus.jsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import NavBar from "../components/NavBar";

/* --- petit badge statut, auto-fetch --- */
function PlusStatusBadge() {
  const [status, setStatus] = useState("none");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setStatus(j?.status || "none");
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  const map = {
    active: { label: "Actif", cls: "badge-success" },
    pending: { label: "En attente", cls: "badge-warning" },
    canceled: { label: "Annulé", cls: "badge-error" },
    none: { label: "Inactif", cls: "badge-ghost" },
  };
  const info = map[String(status).toLowerCase()] || map.none;
  return <span className={`badge ${info.cls}`}>Statut EDB Plus : {info.label}</span>;
}

export default function PlusPage() {
  const { data: session } = useSession();
  const isAuth = !!session?.user?.email;

  const benefits = useMemo(
    () => [
      { title: "Fiches & synthèses", desc: "Supports clairs pour réviser vite et bien." },
      { title: "Challenge exclusif", desc: "Simulateur avancé : long/short, calls/puts, graphiques…" },
      { title: "Support prioritaire", desc: "On répond à tes questions en priorité." },
      { title: "EDB Night", desc: "Sessions de nuit (Asian session) entre membres." },
      { title: "EDB Plus Session", desc: "Atelier après chaque mini-cours (13h35 → …)." },
      { title: "Priorité Partner Talk", desc: "Place réservée sur les confs partenaires." },
      { title: "Priorité Road Trip", desc: "Accès prioritaire aux sorties/visites finance." },
      { title: "Accès prioritaire Mastermind", desc: "Week-end crypto & scalping (château)." },
      { title: "Goodies", desc: "Un peu de swag pour les membres 😉" },
    ],
    []
  );

  async function handleSubscribe() {
    // 1) pas connecté → redirige vers login
    if (!isAuth) {
      window.location.href = `/login?next=/plus&intent=subscribe`;
      return;
    }
    // 2) connecté → tente de créer un checkout SumUp
    try {
      const r = await fetch("/api/sumup/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "EDB_PLUS" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && (j.checkout_url || j.checkoutUrl || j.url)) {
        window.location.href = j.checkout_url || j.checkoutUrl || j.url;
        return;
      }
      // repli : lance l’OAuth SumUp (pour connecter l’app si scope checkout pas encore actif)
      window.location.href = "/api/sumup/oauth/start";
    } catch {
      window.location.href = "/api/sumup/oauth/start";
    }
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-6xl mx-auto p-6">
        {/* HERO */}
        <section className="rounded-3xl border bg-base-100 p-6 md:p-10 shadow relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-extrabold">EDB Plus</h1>
              <p className="opacity-80 mt-2 max-w-2xl">
                Le raccourci pour progresser : ateliers, priorités d’accès, ressources et challenge
                avancé. Tout ce qu’il faut pour passer un cap, sans prise de tête.
              </p>
              <div className="mt-3"><PlusStatusBadge /></div>
            </div>

            <div className="shrink-0 rounded-2xl border bg-base-200 p-5 text-center w-full md:w-80">
              <div className="text-5xl font-extrabold">20 €</div>
              <div className="opacity-70 -mt-1">/ mois</div>
              <button onClick={handleSubscribe} className="btn btn-primary w-full mt-4">
                Rejoindre EDB Plus
              </button>
              {!isAuth && (
                <div className="text-xs opacity-70 mt-2">
                  Tu devras d’abord te connecter / créer un compte.
                </div>
              )}
              <div className="text-[10px] opacity-60 mt-3">
                Paiement via SumUp. Redirection sécurisée.
              </div>
            </div>
          </div>
        </section>

        {/* BÉNÉFICES */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Tout ce que tu obtiens</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border bg-base-100 p-5 shadow-sm hover:shadow transition">
                <div className="font-semibold">{b.title}</div>
                <div className="opacity-70 text-sm mt-1">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARATIF */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Gratuit vs EDB Plus</h2>
          <div className="overflow-x-auto mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Fonctionnalités</th>
                  <th className="text-center">EDB Free</th>
                  <th className="text-center">EDB Plus</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Mini-cours du jeudi (13h–13h30)", "Oui", "Oui"],
                  ["Simulateur & portefeuille", "Basique", "Avancé (long/short, calls/puts, graphiques)"],
                  ["Classement", "Public", "Exclusif + défis dédiés"],
                  ["Fiches & synthèses", "—", "✔︎"],
                  ["EDB Plus Session (après chaque cours)", "—", "✔︎"],
                  ["EDB Night", "—", "✔︎"],
                  ["Partner Talk", "Accès standard", "Prioritaire"],
                  ["Road Trip", "Accès standard", "Prioritaire"],
                  ["Mastermind (week-end crypto)", "—", "Accès prioritaire"],
                  ["Support", "Standard", "Prioritaire"],
                  ["Goodies", "—", "✔︎"],
                ].map(([feat, free, pro], i) => (
                  <tr key={i}>
                    <td className="font-medium">{feat}</td>
                    <td className="text-center">{free}</td>
                    <td className="text-center">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">FAQ</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {[
              {
                q: "Puis-je annuler à tout moment ?",
                a: "Oui. Tu peux demander l’arrêt du renouvellement. L’accès reste actif jusqu’à la fin de la période en cours.",
              },
              {
                q: "Comment se passent les paiements ?",
                a: "Les paiements sont gérés par SumUp, via une page de paiement sécurisée. Aucune donnée bancaire n’est stockée sur notre site.",
              },
              {
                q: "Les mini-cours gratuits restent accessibles ?",
                a: "Oui ! EDB Free garde l’accès aux mini-cours chaque jeudi 13h–13h30 et au simulateur basique.",
              },
              {
                q: "Que contient exactement le simulateur avancé ?",
                a: "Positions long/short, options basiques (calls/puts), métriques et graphiques supplémentaires, et des défis dédiés EDB Plus.",
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="collapse collapse-arrow bg-base-100 rounded-2xl border">
                <input type="checkbox" />
                <div className="collapse-title text-md font-semibold">{q}</div>
                <div className="collapse-content opacity-80">{a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOT CTA */}
        <section className="mt-12 text-center">
          <div className="rounded-3xl border bg-base-100 p-6 shadow inline-block">
            <div className="text-xl font-bold">Prêt à accélérer ?</div>
            <div className="opacity-70 mt-1">EDB Plus — 20 € / mois, sans engagement.</div>
            <div className="mt-4 flex gap-3 justify-center">
              <button onClick={handleSubscribe} className="btn btn-primary">Rejoindre EDB Plus</button>
              {!isAuth && <Link href="/login?next=/plus" className="btn btn-outline">Se connecter</Link>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}