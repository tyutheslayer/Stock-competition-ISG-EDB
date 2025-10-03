// components/FeatureGrid.jsx
import { Trophy, Calendar, BarChart3, Shield, Sparkles, Users } from "lucide-react";

const FEATURES = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Sans risque",
    desc: "Joue en conditions réelles avec de la monnaie virtuelle et apprends en toute sécurité.",
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Mini-cours gratuits",
    desc: "Chaque jeudi 13h–13h30 : bases, astuces, et Q&A pour progresser vite.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Outils de suivi",
    desc: "Portefeuille, historique, P&L en EUR, frais configurables par l’admin.",
  },
  {
    icon: <Trophy className="w-5 h-5" />,
    title: "Classements & badges",
    desc: "Motivation garantie : jour/semaine/mois/saison + badges spéciaux.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Communauté",
    desc: "Compare-toi à ta promo, partage tes idées, et apprends ensemble.",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "Plan Pro",
    desc: "Ateliers, replays, watchlists avancées, ressources premium (bientôt).",
  },
];

export default function FeatureGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {FEATURES.map((f, i) => (
        <div
          key={i}
          className="rounded-2xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-xl transition p-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
              {f.icon}
            </div>
            <h3 className="font-semibold text-lg">{f.title}</h3>
          </div>
          <p className="mt-3 text-sm opacity-80 leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}