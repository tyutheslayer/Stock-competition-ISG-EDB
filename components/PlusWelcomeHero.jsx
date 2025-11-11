// components/PlusWelcomeHero.jsx
import Link from "next/link";

export default function PlusWelcomeHero({ me }) {
  return (
    <section className="plus-hero rounded-3xl glass p-6 md:p-8 mb-6 overflow-hidden">
      <div className="gold-sheen" aria-hidden="true" />
      <div className="relative">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Exclusive members area
        </div>

        <h1 className="gold-title text-3xl md:text-5xl font-extrabold mt-1 animate-riseIn">
          Bienvenue dans <span className="text-primary">EDB Plus</span>
        </h1>

        <div className="gold-underline mt-3 mb-2" />

        <p className="mt-2 md:text-lg opacity-90 max-w-3xl animate-fadeIn">
          « Investir, c’est plus que des chiffres — c’est une discipline. »
        </p>

        <div className="mt-5 flex flex-wrap gap-2 animate-fadeInDelay">
          <Link href="/plus/sheets" className="btn btn-primary">📚 Ressources privées</Link>
          <Link href="/quizzes" className="btn btn-outline">🧠 Quiz Plus</Link>
          <Link href="/leaderboard" className="btn btn-outline">🏆 Classement</Link>
          <Link href="/portfolio" className="btn btn-outline">💼 Mon portefeuille</Link>
        </div>
      </div>
    </section>
  );
}