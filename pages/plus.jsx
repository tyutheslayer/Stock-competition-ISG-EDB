// pages/plus.jsx
import Head from "next/head";
import NavBar from "../components/NavBar";
import Link from "next/link";
import { useState } from "react";

const perks = [
  "Fiches & synthèses",
  "Challenge Exclusif (simulateur avancé : long/short, call/put, graphiques…)",
  "Support prioritaire",
  "EDB Night",
  "EDB Plus Session (après chaque cours)",
  "Priorité Partner Talk",
  "Priorité Road Trip",
  "Accès prioritaire Mastermind (week-end crypto, château)",
  "Goodies",
];

export default function Plus() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function startCheckout() {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/sumup/create-checkout", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "create_failed");
      window.location.href = j.url; // redirection vers SumUp
    } catch (e) {
      setErr("Impossible de lancer le paiement. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>EDB Plus — Abonnement</title>
      </Head>
      <NavBar />
      <main className="page max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">Passe à <span className="text-primary">EDB Plus</span></h1>
        <p className="opacity-80 mb-6">
          Accède aux ateliers, à la priorité sur les événements et à l’outil de trading avancé.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-base-100 p-5">
            <h2 className="text-xl font-semibold mb-2">EDB Free</h2>
            <p className="opacity-80">Mini-cours chaque jeudi 13h–13h30, simulateur de base, classement.</p>
            <div className="mt-4">
              <Link href="/login" className="btn btn-outline">Commencer gratuitement</Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-base-100 p-5">
            <h2 className="text-xl font-semibold mb-2">EDB Plus</h2>
            <div className="text-3xl font-bold">20 € <span className="text-base opacity-70">/mois</span></div>
            <ul className="list-disc ml-5 mt-3 space-y-1">
              {perks.map((p) => <li key={p}>{p}</li>)}
            </ul>
            {err && <div className="alert alert-warning mt-4">{err}</div>}
            <button
              className={`btn btn-primary mt-5 ${loading ? "btn-disabled" : ""}`}
              onClick={startCheckout}
            >
              {loading ? "Redirection…" : "Payer 20 € via SumUp"}
            </button>
            <p className="text-xs opacity-60 mt-2">
              Paiement hébergé par SumUp. Redirection sécurisée.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <Link href="/calendar" className="link link-primary">Voir le calendrier des événements →</Link>
        </div>
      </main>
    </>
  );
}