import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Utilitaires "Europe/Paris" (sans lib externe) */
function getParisNow() {
  const now = new Date();
  // On fabrique un "Date" qui porte l'heure locale de Paris
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = paris.getTime() - utc.getTime();
  return new Date(now.getTime() + offset);
}
function nextThursdayNoonParis(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay(); // 0=dim, 4=jeudi
  let add = (4 - day + 7) % 7;
  // si on est déjà jeudi mais après/pile 12:00, on vise la semaine prochaine
  const test = new Date(d);
  test.setHours(12, 0, 0, 0);
  if (add === 0 && d.getTime() >= test.getTime()) add = 7;

  const target = new Date(d);
  target.setDate(d.getDate() + add);
  target.setHours(12, 0, 0, 0);
  return target;
}
function formatDHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return { days, hh: pad(h), mm: pad(m), ss: pad(s) };
}

export default function Hero() {
  // état & tick
  const [nowParis, setNowParis] = useState(getParisNow());
  useEffect(() => {
    const id = setInterval(() => setNowParis(getParisNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = useMemo(() => nextThursdayNoonParis(nowParis), [nowParis]);
  const remainingMs = Math.max(0, target.getTime() - nowParis.getTime());
  const { days, hh, mm, ss } = useMemo(() => formatDHMS(remainingMs), [remainingMs]);
  const registrationsOpen = remainingMs === 0;

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

              {/* Bandeau compte à rebours (avant ouverture) */}
              {!registrationsOpen && (
                <div className="mt-4 rounded-2xl border border-white/15 bg-white/8 backdrop-blur-md p-4 text-center md:text-left">
                  <div className="text-sm opacity-80">Ouverture des inscriptions</div>
                  <div className="mt-1 text-2xl font-extrabold">
                    {days > 0 ? `${days}j ` : ""}
                    {hh}:{mm}:{ss}
                  </div>
                  <div className="text-xs opacity-60 mt-1">Jeudi 12:00 — heure de Paris</div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                {registrationsOpen ? (
                  <Link href="/register" className="btn btn-primary w-full sm:w-auto">
                    Mini-cours gratuit (créer un compte)
                  </Link>
                ) : (
                  <button className="btn btn-primary btn-disabled w-full sm:w-auto" disabled>
                    Inscriptions — ouverture jeudi 12:00
                  </button>
                )}

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