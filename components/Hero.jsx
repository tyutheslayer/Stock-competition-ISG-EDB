// components/Hero.jsx
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-8">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              L’<span className="text-primary">École de la Bourse</span> :
              apprends en simulant, <span className="whitespace-nowrap">progresse sans risque</span>
            </h1>
            <p className="mt-4 text-lg opacity-80">
              Un simulateur simple, un classement motivant, et des{" "}
              <b>mini-cours gratuits chaque jeudi 13h–13h30</b>.
              Passe au plan Pro pour des ateliers, replays, et outils avancés.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {/* 👉 Tout le monde passe par la création de compte */}
              <Link href="/register" className="btn btn-primary">
                Mini-cours gratuit (créer un compte)
              </Link>

              <Link href="/plus" className="btn btn-outline">
                Découvrir EDB Plus
              </Link>

              <Link href="/calendar" className="btn btn-ghost">
                Calendrier des sessions
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-4 text-sm">
              <div className="badge badge-primary badge-outline">Gratuit</div>
              <div className="badge badge-ghost">Sans CB</div>
              <div className="badge badge-ghost">Ouvert à tous</div>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="rounded-2xl shadow-xl bg-base-100 p-4 md:p-6 border">
              <div className="text-sm opacity-70 mb-2">Aperçu du tableau de bord</div>
              <div className="stats w-full shadow">
                <div className="stat">
                  <div className="stat-title">Valorisation actions</div>
                  <div className="stat-value">€ 42 350</div>
                  <div className="stat-desc">+2,4% aujourd’hui</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Cash</div>
                  <div className="stat-value">€ 57 650</div>
                  <div className="stat-desc">Prêt à investir</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-sm opacity-70">Classement</div>
                  <div className="font-semibold">Top 10</div>
                </div>
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-sm opacity-70">Badges</div>
                  <div className="font-semibold">“Meilleur trade”</div>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/leaderboard" className="link link-primary">
                  Voir le classement →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}