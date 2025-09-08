import Link from "next/link";
import NavBar from "../components/NavBar";

export default function Home() {
  return (
    <div>
      <NavBar />
      <div className="container">
        <h1>Compétition d’investissement — MVP</h1>
        <p>Plateforme éducative pour simuler l’achat/vente d’actions (cours différés), suivre un portefeuille et un classement.</p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <Link className="btn" href="/register">Créer un compte</Link>
          <Link className="btn" href="/login">Se connecter</Link>
          <Link className="btn" href="/trade">Aller trader</Link>
        </div>
        <div className="card">
          <b>Important</b>
          <p>Les données proviennent d’une API non officielle (Yahoo Finance) et peuvent être limitées/différées (~15 min). Usage pédagogique uniquement.</p>
        </div>
      </div>
    </div>
  );
}
