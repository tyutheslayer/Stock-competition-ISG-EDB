// pages/plus.jsx
import Link from "next/link";
import PlusStatusBadge from "../components/PlusStatusBadge";

export default function PlusPage() {
  return (
    <div className="page max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold text-center">EDB Plus</h1>
      <PlusStatusBadge />

      <div className="mt-6 text-lg">
        <p className="mb-4">
          Passe au plan <b>EDB Plus</b> et débloque les avantages exclusifs :
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Fiches & synthèses</li>
          <li>Challenge exclusif (simulateur avancé : long/short, call/put, graphiques…)</li>
          <li>Support prioritaire</li>
          <li>EDB Night & sessions spéciales</li>
          <li>Accès prioritaire aux évènements (Partner Talk, Road Trip, Mastermind…)</li>
          <li>Goodies réservés aux abonnés</li>
        </ul>
      </div>

      <div className="mt-8 text-center">
        {/* Si l’API SumUp n’est pas encore activée → message */}
        <div className="alert alert-warning mb-4">
          Paiement en ligne en cours d’activation (via SumUp).
        </div>

        {/* Bouton SumUp (sera activé dès que scope checkout dispo) */}
        <Link
          href="/api/sumup/create-checkout"
          className="btn btn-primary"
        >
          Payer 20 € via SumUp
        </Link>
      </div>
    </div>
  );
}