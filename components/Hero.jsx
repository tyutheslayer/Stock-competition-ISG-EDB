// components/Hero.jsx
import Link from "next/link";

export default function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-16 pb-8">
      {/* Carte isolée, sans compte à rebours */}
      <div
        className="relative z-[5] rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-xl"
        style={{ isolation: "isolate" }}
      >
        {/* Dégradé décoratif sous le contenu */}
        <div className="absolute inset-0 -z-[1] pointer-events-none rounded-3xl bg-gradient-to-b from-primary/10 via-transparent to-transparent" />

        <div className="relative z-10 p-5 md:p-10">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            {/* Texte */}
            <div className="md:col-span-7 text-center md:text-left">
              <h1
                lang="fr"
                className="
                  font-extrabold leading-tight tracking-normal sm:tracking-tight
                  text-[clamp(1.9rem,6.2vw,2.5rem)] sm:text-4xl md:text-5xl
                  max-w-[28ch] sm:max-w-none mx-auto md:mx-0
                  [text-wrap:balance] break-words [overflow-wrap:anywhere] [hyphens:auto]
                "
              >
                <span className="block sm:inline">
                  L’<span className="text-primary">École de la Bourse</span>
                </span>
                <span className="hidden sm:inline"> : </span>
                <span className="block sm:inline">apprends en simulant, </span>
                <span className="block sm:inline">progresse sans risque</span>
              </h1>

              <p className="mt-3 sm:mt-4 text-base sm:text-lg opacity-80">
                Un simulateur simple, un classement motivant, et des{" "}
                <b>mini-cours gratuits chaque jeudi 13h–13h30</b>. Passe au plan Pro pour des ateliers, replays, et outils avancés.
              </p>

              {/* CTA – inscriptions ouvertes en permanence */}
              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 justify-center sm:justify-start">
                <Link href="/register" className="btn btn-primary w-full sm:w-auto">
                  Mini-cours gratuit (créer un compte)
                </Link>
                <Link href="/plus" className="btn btn-outline w-full sm:w-auto">
                  Découvrir EDB Plus
                </Link>
                <Link href="/calendar" className="btn btn-ghost w-full sm:w-auto">
                  Calendrier des sessions
                </Link>
              </div>

              {/* Badges */}
              <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
                <div className="badge badge-primary badge-outline">Gratuit</div>
                <div className="badge badge-ghost">Sans CB</div>
                <div className="badge badge-ghost">Ouvert à tous</div>
              </div>
            </div>

            {/* Carte d’aperçu */}
            <div className="md:col-span-5">
              <div className="rounded-2xl bg-base-100/70 border border-white/10 shadow-xl p-4 md:p-6">
                <div className="text-sm opacity-70 mb-2">Aperçu du tableau de bord</div>

                <div className="stats w-full shadow-sm">
                  <div className="stat">
                    <div className="stat-title">Valorisation actions</div>
                    <div className="stat-value text-xl sm:text-2xl md:text-3xl">€ 42 350</div>
                    <div className="stat-desc">+2,4% aujourd’hui</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Cash</div>
                    <div className="stat-value text-xl sm:text-2xl md:text-3xl">€ 57 650</div>
                    <div className="stat-desc">Prêt à investir</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-base-200/60 border border-white/10">
                    <div className="text-sm opacity-70">Classement</div>
                    <div className="font-semibold">Top 10</div>
                  </div>
                  <div className="p-3 rounded-xl bg-base-200/60 border border-white/10">
                    <div className="text-sm opacity-70">Badges</div>
                    <div className="font-semibold">“Meilleur trade”</div>
                  </div>
                </div>

                <div className="mt-4 text-center md:text-left">
                  <Link href="/leaderboard" className="link link-primary">
                    Voir le classement →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>      
    </section>
  );
}