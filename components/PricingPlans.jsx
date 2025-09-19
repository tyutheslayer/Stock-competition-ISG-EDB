// components/PricingPlans.jsx
import Link from "next/link";

function PlanCard({ title, price, period, bullets, ctaLabel, ctaHref, highlighted }) {
  return (
    <div className={`rounded-2xl border bg-base-100 p-6 shadow ${highlighted ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="text-right">
          <div className="text-3xl font-extrabold">
            {price}
            {period && <span className="text-base font-medium opacity-70">/{period}</span>}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link href={ctaHref} className={`btn mt-6 w-full ${highlighted ? "btn-primary" : "btn-outline"}`}>
        {ctaLabel}
      </Link>
    </div>
  );
}

export default function PricingPlans() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-center">Choisis ton plan</h2>
      <p className="text-center opacity-80 mt-1">
        Commence gratuitement, passe au Pro quand tu veux.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <PlanCard
          title="Gratuit"
          price="0€"
          period=""
          bullets={[
            "Mini-cours du jeudi (13h–13h30)",
            "Simulateur & portefeuille",
            "Classement public",
            "Watchlist basique",
          ]}
          ctaLabel="Commencer gratuitement"
          ctaHref="/login"
        />
        <PlanCard
          title="Pro"
          price="Bientôt"
          period=""
          bullets={[
            "Ateliers & replays",
            "Watchlists avancées",
            "Ressources premium",
            "Accès prioritaire aux évènements",
          ]}
          ctaLabel="Voir les avantages"
          ctaHref="/plus"
          highlighted
        />
      </div>
    </div>
  );
}