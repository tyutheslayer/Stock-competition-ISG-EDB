// pages/plus.jsx
import Head from "next/head";
import Link from "next/link";
import NavBar from "../components/NavBar";

export default function PlusPage() {
  return (
    <>
      <Head>
        <title>EDB Plus – École de la Bourse</title>
        <meta
          name="description"
          content="Passe à EDB Plus pour débloquer fiches & synthèses, challenge exclusif, EDB Night, sessions Plus, accès prioritaire aux événements et bien plus."
        />
      </Head>

      <div className="min-h-screen bg-base-100">
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {/* Hero */}
          <section className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Passe à <span className="text-primary">EDB Plus</span>
            </h1>
            <p className="mt-4 text-lg opacity-80 max-w-3xl mx-auto">
              Tu as EDB Free pour démarrer. Avec EDB Plus, tu accèdes aux outils,
              aux sessions et aux événements qui accélèrent vraiment ta progression.
            </p>
          </section>

          {/* Cartes plans */}
          <section className="grid md:grid-cols-2 gap-8 mb-16">
            {/* EDB Free */}
            <div className="p-6 rounded-2xl shadow bg-base-200">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">EDB Free</h2>
                <div className="badge">Gratuit</div>
              </div>
              <p className="opacity-70 mb-4">
                Idéal pour découvrir l’École de la Bourse.
              </p>
              <ul className="space-y-2 list-disc list-inside opacity-90">
                <li>Mini-cours chaque jeudi 13h–13h30</li>
                <li>Simulateur de trading (version standard)</li>
                <li>Classement public</li>
                <li>Accès au calendrier des événements publics</li>
              </ul>

              <div className="mt-6">
                <Link href="/login" className="btn btn-ghost w-full">
                  Continuer avec EDB Free
                </Link>
              </div>
            </div>

            {/* EDB Plus */}
            <div className="p-6 rounded-2xl shadow bg-primary text-primary-content relative overflow-hidden">
              <div className="absolute right-4 top-4 badge badge-accent text-xs">
                Recommandé
              </div>
              <h2 className="text-2xl font-extrabold">EDB Plus</h2>
              <div className="mt-2 flex items-end gap-2">
                <div className="text-4xl font-black leading-none">20€</div>
                <div className="opacity-80 mb-1">/ mois</div>
              </div>
              <p className="mt-2 opacity-90">
                Le meilleur de l’EDB : contenus, sessions, priorités & évènements.
              </p>

              <div className="divider divider-primary my-4" />

              <ul className="space-y-2 list-disc list-inside">
                <li><b>Fiches & Synthèses</b> des cours</li>
                <li>
                  <b>Challenge Exclusif</b> (simulateur amélioré : long/short, calls/puts,
                  graphiques, et plus)
                </li>
                <li><b>Priorité de support</b> (réponse plus rapide)</li>
                <li><b>EDB Night</b> (sessions Asian session)</li>
                <li><b>EDB Plus Session</b> après chaque cours</li>
                <li><b>Prioritaire</b> sur les <b>Partner Talk</b></li>
                <li><b>Prioritaire</b> sur le <b>Road Trip</b></li>
                <li><b>Accès prioritaire Mastermind</b> (week-end crypto/scalping en château)</li>
                <li><b>Goodies</b> EDB</li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/checkout" // TODO: remplace par Stripe Checkout quand prêt
                  className="btn btn-neutral w-full"
                >
                  Passer à EDB Plus
                </Link>
                <p className="mt-2 text-xs opacity-80">
                  Paiement sécurisé. Annulable à tout moment.
                </p>
              </div>
            </div>
          </section>

          {/* Petit comparatif succinct (optionnel) */}
          <section className="rounded-2xl shadow bg-base-100 border p-6">
            <h3 className="text-xl font-semibold mb-3">EDB Free vs EDB Plus</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-base-200">
                <div className="font-semibold mb-2">EDB Free</div>
                <p className="opacity-80">
                  Tu apprends les bases gratuitement et tu participes au classement.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-base-200">
                <div className="font-semibold mb-2">EDB Plus</div>
                <p className="opacity-80">
                  Tu as tout pour performer : ressources premium, accès prioritaires,
                  et événements exclusifs.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}