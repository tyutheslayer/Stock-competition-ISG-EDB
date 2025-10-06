// pages/rules.js
import PageShell from "../components/PageShell";
import GlassPanel from "../components/GlassPanel";

export default function RulesPage() {
  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-4 sm:gap-5">
        {/* Titre + résumé */}
        <section className="col-span-12">
          <GlassPanel className="text-slate-100">
            <h1 className="text-2xl sm:text-3xl font-bold">Règles du jeu</h1>
            <p className="mt-2 opacity-80 text-sm sm:text-base">
              Tu démarres avec un capital virtuel identique aux autres joueurs. L’objectif :
              finir la saison avec la meilleure performance tout en respectant les limites de risque.
            </p>

            {/* Stats compactes en mobile, 3 colonnes dès sm */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs sm:text-sm opacity-70">Capital initial</div>
                <div className="text-lg sm:text-xl font-semibold">100 000 €</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs sm:text-sm opacity-70">Durée d’une saison</div>
                <div className="text-lg sm:text-xl font-semibold">~ 7 mois</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs sm:text-sm opacity-70">Classement</div>
                <div className="text-lg sm:text-xl font-semibold">Perf. % vs équity</div>
              </div>
            </div>
          </GlassPanel>
        </section>

        {/* Règles détaillées */}
        <section className="col-span-12 md:col-span-8 space-y-4">
          <GlassPanel>
            <h2 className="text-xl sm:text-2xl font-semibold">1. Marchés & instruments</h2>
            <ul className="list-disc pl-5 sm:pl-6 mt-2 space-y-1.5 sm:space-y-1 opacity-90 text-sm sm:text-base">
              <li>Actions US & Europe (ex. : AAPL, NVDA, AIR.PA…).</li>
              <li>Conversion automatique en EUR pour l’affichage et les calculs.</li>
              <li>Prix réels (retardés/simplifiés), dans un cadre pédagogique.</li>
            </ul>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-xl sm:text-2xl font-semibold">2. Frais & exécution</h2>
            <ul className="list-disc pl-5 sm:pl-6 mt-2 space-y-1.5 sm:space-y-1 opacity-90 text-sm sm:text-base">
              <li>Frais au ticket (en bps), visibles avant validation.</li>
              <li>Ordres « au marché » au dernier prix connu.</li>
              <li>Pas de latence volontaire — pas de scalping.</li>
            </ul>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-xl sm:text-2xl font-semibold">3. Risque & limites</h2>
            <ul className="list-disc pl-5 sm:pl-6 mt-2 space-y-1.5 sm:space-y-1 opacity-90 text-sm sm:text-base">
              <li>Taille max par position : 25 % de l’équity.</li>
              <li>Levier via module <em>EDB Plus</em> (pour comptes autorisés).</li>
              <li>Stop Loss / Take Profit réels sur positions à levier.</li>
            </ul>
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-xl sm:text-2xl font-semibold">4. Classement</h2>
            <ul className="list-disc pl-5 sm:pl-6 mt-2 space-y-1.5 sm:space-y-1 opacity-90 text-sm sm:text-base">
              <li>Périodes : jour, semaine, mois, saison.</li>
              <li>Perf. calculée sur l’<strong>équity</strong> (cash + valorisation).</li>
              <li>Ex æquo : plus faible volatilité puis plus faible drawdown.</li>
            </ul>
          </GlassPanel>
        </section>

        {/* FAQ + Bonnes pratiques */}
        <aside className="col-span-12 md:col-span-4">
          <GlassPanel>
            <h2 className="text-xl sm:text-2xl font-semibold">FAQ</h2>

            <div className="mt-3 space-y-2">
              <details className="rounded-lg bg-white/5 p-3">
                <summary className="cursor-pointer font-medium text-sm sm:text-base">
                  Comment ajouter un titre à ma watchlist ?
                </summary>
                <p className="mt-2 opacity-80 text-sm">
                  Ouvre la page Trading, cherche le symbole, puis clique sur l’étoile ☆ sur la fiche.
                </p>
              </details>

              <details className="rounded-lg bg-white/5 p-3">
                <summary className="cursor-pointer font-medium text-sm sm:text-base">
                  Puis-je vendre à découvert sans levier ?
                </summary>
                <p className="mt-2 opacity-80 text-sm">
                  Le short <em>spot</em> n’est pas permis. Pour shorter, active
                  le module <strong>EDB Plus</strong> (levier).
                </p>
              </details>

              <details className="rounded-lg bg-white/5 p-3">
                <summary className="cursor-pointer font-medium text-sm sm:text-base">
                  Quand ma perf. est-elle rafraîchie ?
                </summary>
                <p className="mt-2 opacity-80 text-sm">
                  À chaque exécution d’ordre et lors des mises à jour périodiques des cours.
                </p>
              </details>

              <details className="rounded-lg bg-white/5 p-3">
                <summary className="cursor-pointer font-medium text-sm sm:text-base">
                  Je vois un prix en € mais l’action est en $ ?
                </summary>
                <p className="mt-2 opacity-80 text-sm">
                  Les prix sont convertis automatiquement en EUR via un taux de change interne.
                </p>
              </details>
            </div>
          </GlassPanel>

          <GlassPanel className="mt-4">
            <h3 className="text-lg sm:text-xl font-semibold">Bonnes pratiques</h3>
            <ul className="list-disc pl-5 sm:pl-6 mt-2 space-y-1.5 sm:space-y-1 opacity-90 text-sm sm:text-base">
              <li>Diversifie (4–8 lignes mini).</li>
              <li>Calibre ton risque par trade (ex. 1 % d’équity).</li>
              <li>Tiens un journal d’idées (raison d’entrée/sortie).</li>
            </ul>
          </GlassPanel>
        </aside>
      </div>
    </PageShell>
  );
}