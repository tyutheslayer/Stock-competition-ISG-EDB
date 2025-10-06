import Link from "next/link";

export default function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-16 pb-8">
      <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/10 via-transparent to-transparent" />

        <div className="relative p-5 md:p-10">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            {/* Texte */}
            <div className="md:col-span-7 text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight break-words">
                L’<span className="text-primary">École de la Bourse</span> :
                apprends en simulant,{" "}
                <span className="md:whitespace-nowrap">progresse sans risque</span>
              </h1>

              <p className="mt-3 sm:mt-4 text-base sm:text-lg opacity-80">
                Un simulateur simple, un classement motivant, et des{" "}
                <b>mini-cours gratuits chaque jeudi 13h–13h30</b>.
                Passe au plan Pro pour des ateliers, replays, et outils avancés.
              </p>

              {/* CTA */}
              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3">
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