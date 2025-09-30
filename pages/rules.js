import NavBar from "../components/NavBar";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";


export default function Rules() {
  return (
    <div>
      <NavBar />
      <main className="page py-10 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-primary text-center">Règles du jeu</h1>
        <ul className="mt-6 list-disc pl-6 space-y-2">
          <li>Capital initial : 100 000 (virtuel)</li>
          <li>Aucun levier / marge ; pas de vente à découvert</li>
          <li>Ordres au prix du marché (simulation) ; cours potentiellement différés</li>
          <li>Frais fictifs : 0,1% par ordre (peuvent être ajustés)</li>
          <li>Classement par équité (cash + positions) ; égalités départagées ultérieurement</li>
          <li>Nom affiché : 1 changement / 15 jours (admins illimités)</li>
        </ul>
        <p className="mt-4 text-sm opacity-70">
          Ce site est une simulation éducative. Aucune recommandation d’investissement.
        </p>
      </main>
    </div>
  );
}
