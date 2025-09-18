// components/FeatureGrid.jsx
const FEATURES = [
  { title: "Mini-cours hebdo", desc: "Chaque jeudi 13h–13h30. Gratuit, sans carte.", icon: "🎓" },
  { title: "Simulateur & Ordres", desc: "Passe des ordres, suis ta perf, comprends tes P&L.", icon: "📈" },
  { title: "Classement", desc: "Classement par jour/semaine/mois/saison.", icon: "🏆" },
  { title: "Ressources Plus", desc: "Fiches, replays, challenges privés (offre Plus).", icon: "💎" },
];

export default function FeatureGrid() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center">Pensé pour apprendre en faisant</h2>
        <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-base-100 p-5 shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="text-sm opacity-70">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}