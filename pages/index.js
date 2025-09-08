import Link from "next/link";
import NavBar from "../components/NavBar";

export default function Home() {
  return (
    <div>
      <NavBar />
      <main className="page flex flex-col items-center justify-center text-center py-10">
        <h1 className="text-4xl font-bold text-isg">Compétition d’investissement</h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          Participez à la simulation boursière de l’ISG : achetez et vendez des actions,
          suivez votre portefeuille et comparez vos performances avec vos camarades.
        </p>
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <Link className="btn bg-isg text-white" href="/register">Créer un compte</Link>
          <Link className="btn btn-outline" href="/login">Se connecter</Link>
          <Link className="btn btn-secondary" href="/trade">Aller trader</Link>
        </div>
      </main>
    </div>
  );
}
