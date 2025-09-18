// components/PricingPlans.jsx
export default function PricingPlans() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-base-200/40">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center">Choisis ta formule</h2>
        <p className="text-center opacity-70 mt-2">Commence gratuitement, passe en Plus quand tu veux.</p>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {/* Gratuit */}
          <div className="rounded-2xl border bg-base-100 shadow p-6 flex flex-col">
            <div className="text-sm font-semibold uppercase tracking-wide opacity-70">Gratuit</div>
            <div className="mt-2 text-4xl font-extrabold">0€</div>
            <div className="opacity-70 text-sm">à vie</div>
            <ul className="mt-6 space-y-2">
              <li>✓ Mini-cours <b>chaque jeudi</b> 13h–13h30</li>
              <li>✓ Accès au simulateur de base</li>
              <li>✓ Accès au classement public</li>
            </ul>
            <a href="/register" className="btn btn-outline mt-8">Créer un compte</a>
          </div>

          {/* Plus */}
          <div className="rounded-2xl border bg-base-100 shadow-lg p-6 ring-2 ring-primary/30 flex flex-col">
            <div className="text-sm font-semibold uppercase tracking-wide text-primary">Plus</div>
            <div className="mt-2 text-4xl font-extrabold">XX€/mois</div>
            <div className="opacity-70 text-sm">sans engagement</div>
            <ul className="mt-6 space-y-2">
              <li>✓ Tout le Gratuit</li>
              <li>✓ Replays & fiches synthèse</li>
              <li>✓ Challenges privés & analyses</li>
              <li>✓ Ressources avancées (TP, cas réels)</li>
              <li>✓ Accès priorité & support</li>
            </ul>
            <div className="mt-8 flex flex-col gap-2">
              <a href="/plus" className="btn btn-ghost">Voir tout ce qui est inclus</a>
              <a href="/checkout" className="btn btn-primary">Passer en Plus</a>
            </div>
          </div>
        </div>

        <p className="text-xs opacity-60 text-center mt-6">
          Le prix “Plus” est un placeholder — on branchera Stripe ensuite.
        </p>
      </div>
    </section>
  );
}