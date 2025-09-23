// pages/plus.jsx
import Head from "next/head";
import NavBar from "../components/NavBar";
import Link from "next/link";

export default function PlusPage() {
  return (
    <>
      <Head>
        <title>Plan Pro – École de la Bourse</title>
        <meta
          name="description"
          content="Passe au plan Pro pour débloquer ateliers, replays et outils avancés de l'École de la Bourse."
        />
      </Head>

      <div className="min-h-screen bg-base-100">
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-4xl font-extrabold mb-6 text-center">
            🚀 Passe au <span className="text-primary">Plan Pro</span>
          </h1>
          <p className="text-lg opacity-80 text-center max-w-2xl mx-auto mb-12">
            Tu as déjà accès aux <b>mini-cours gratuits</b>.  
            Avec le plan Pro, tu vas encore plus loin : ateliers pratiques, replays, sessions de trading et événements exclusifs.
          </p>

          {/* Comparatif Gratuit vs Pro */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="p-6 rounded-2xl shadow bg-base-200">
              <h2 className="text-xl font-bold mb-4">Gratuit</h2>
              <ul className="space-y-2 list-disc list-inside opacity-80">
                <li>Mini-cours tous les jeudis 13h–13h30</li>
                <li>Accès au simulateur de trading</li>
                <li>Classement national</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl shadow bg-primary text-primary-content">
              <h2 className="text-xl font-bold mb-4">Plan Pro</h2>
              <ul className="space-y-2 list-disc list-inside">
                <li><b>Sessions de trading “Plus”</b> après chaque cours</li>
                <li><b>Replays vidéo</b> disponibles 24/7</li>
                <li><b>EDB Nights</b> (sessions spéciales Asian session)</li>
                <li><b>Événements exclusifs</b> : Mastermind, Road Trip</li>
                <li>Accès prioritaire au support</li>
              </ul>
            </div>
          </div>

          {/* CTA vers paiement */}
          <div className="text-center">
            <Link
              href="/checkout" // plus tard ce sera remplacé par Stripe Checkout
              className="btn btn-primary btn-lg"
            >
              Passer au Plan Pro
            </Link>
            <p className="mt-2 text-sm opacity-70">
              Paiement sécurisé (Stripe). Annulable à tout moment.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}