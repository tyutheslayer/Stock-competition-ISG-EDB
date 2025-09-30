import Link from "next/link";
import HoloChart from "../../components/HoloChart";
import OptionsPayoff from "../../components/OptionsPayoff";

export default function PlusLab() {
  return (
    <div className="min-h-screen bg-grid">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-extrabold neon">EDB Plus — Lab</h1>
        <nav className="flex gap-3">
          <Link className="btn btn-ghost" href="/plus">Retour /plus</Link>
          <Link className="btn btn-outline" href="/plus/resources">Fiches & Synthèses</Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        <section className="grid md:grid-cols-2 gap-6">
          <HoloChart symbol="AAPL" range="1mo" />
          <OptionsPayoff />
        </section>

        <section className="glass rounded-2xl p-6 mt-6">
          <h2 className="text-xl font-semibold mb-2">Challenge Exclusif (démo)</h2>
          <p className="opacity-80 mb-3">
            Le simulateur “Plus” déverrouille long/short, options basiques, et des graphiques avancés.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link className="btn btn-primary" href="/trade">Ouvrir le simulateur classique</Link>
            <Link className="btn btn-secondary" href="/plus/resources">Voir les fiches →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}