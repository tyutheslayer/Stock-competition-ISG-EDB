import Link from "next/link";

const DEMO = [
  { slug: "analyse-technique", title: "Analyse technique — bases", summary: "Tendances, supports/résistances, MME." },
  { slug: "gestion-risque", title: "Gestion du risque", summary: "Sizing, drawdown, règles de money management." },
  { slug: "options-basiques", title: "Options (basics)", summary: "Calls, puts, risques principaux." },
];

export default function ResourcesIndex() {
  return (
    <main className="min-h-screen bg-grid p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold neon mb-4">Fiches & Synthèses</h1>
        <p className="opacity-80 mb-6">Accès prioritaire pour EDB Plus — version démo.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {DEMO.map(it => (
            <Link key={it.slug} href={`/plus/resources/${it.slug}`} className="glass rounded-2xl p-5 hover:ring-2 hover:ring-primary transition">
              <div className="text-lg font-semibold">{it.title}</div>
              <div className="opacity-70 text-sm mt-1">{it.summary}</div>
              <div className="mt-3 text-primary text-sm">Ouvrir →</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}