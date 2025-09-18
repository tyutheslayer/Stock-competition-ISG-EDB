// pages/plus.js
import NavBar from "../components/NavBar";

const BENEFITS = [
  { title: "Replays illimités", desc: "Revois toutes les sessions, à ton rythme." },
  { title: "Fiches & synthèses", desc: "Guides clairs, checklists, exemples concrets." },
  { title: "Challenges privés", desc: "Mises en situation, feedback, classements dédiés." },
  { title: "Ressources avancées", desc: "TP, cas réels, analyses macro & secteurs." },
  { title: "Support prioritaire", desc: "Réponses rapides, orientation personnalisée." },
];

export default function PlusPage() {
  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center">Tout ce que tu débloques avec <span className="text-primary">Plus</span></h1>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border bg-base-100 p-5 shadow-sm">
              <div className="font-semibold">{b.title}</div>
              <div className="text-sm opacity-70">{b.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-base-100 p-6 shadow">
          <h2 className="text-xl font-semibold">Pourquoi ça marche</h2>
          <ul className="mt-3 list-disc pl-5 space-y-1 opacity-80">
            <li>Des mini-cours actionnables, sans blabla.</li>
            <li>Tu pratiques : ordres, positions, P&L.</li>
            <li>Tu compares et progresses avec le classement.</li>
            <li>Tu consolides avec les replays et fiches.</li>
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href="/checkout" className="btn btn-primary">Passer en Plus</a>
          <a href="/calendar" className="btn btn-outline">Voir le calendrier</a>
        </div>

        <p className="text-center text-xs opacity-60 mt-4">
          Paiement non branché ici — on ajoutera Stripe ensuite.
        </p>
      </main>
    </div>
  );
}