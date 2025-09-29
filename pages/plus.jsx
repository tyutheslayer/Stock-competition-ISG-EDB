// pages/plus.jsx
import NavBar from "../components/NavBar";
import PlusStatusBadge from "../components/PlusStatusBadge";
import Link from "next/link";

export default function PlusPage() {
  // Affiche 20 € par défaut, surcharge possible via NEXT_PUBLIC_PLUS_PRICE_EUR
  const price = Number(process.env.NEXT_PUBLIC_PLUS_PRICE_EUR || 20);

  return (
    <div>
      <NavBar />
      <main className="page max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">EDB Plus</h1>
          <p className="opacity-70">Passe au niveau supérieur et progresse plus vite.</p>
          <PlusStatusBadge />
        </header>

        <section className="rounded-2xl border bg-base-100 p-6 shadow">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-semibold">Abonnement EDB Plus</h2>
            <div className="text-right">
              <div className="text-3xl font-extrabold">
                {price} € <span className="text-base font-medium opacity-70">/mois</span>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Fiches &amp; synthèses</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>
                Challenge Exclusif (simulateur avancé : long/short, call/put, graphiques…)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Support prioritaire</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>EDB Night</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>EDB Plus Session (après chaque cours)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Priorité Partner Talk</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Priorité Road Trip</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Accès prioritaire Mastermind (week-end crypto, château)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary/70" />
              <span>Goodies</span>
            </li>
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {/* CTA paiement SumUp (redirige vers l’auth/checkout SumUp) */}
            <a href="/api/sumup/oauth/start" className="btn btn-primary">
              Payer {price} € via SumUp
            </a>
            <Link href="/" className="btn btn-ghost">
              Retour à l’accueil
            </Link>
          </div>

          <p className="mt-3 text-sm opacity-70">
            Paiement hébergé par SumUp. Redirection sécurisée. Si le bouton ne fonctionne pas,
            l’accès “checkout” n’est peut-être pas encore activé côté SumUp — tu pourras quand
            même consulter les avantages ci-dessus.
          </p>
        </section>
      </main>
    </div>
  );
}