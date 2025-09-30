// pages/auth/error.js
import Link from "next/link";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";


export default function AuthErrorPage({ query }) {
  const msg = query?.error === "AccessDenied"
    ? "Seules les adresses @isg.fr sont autorisées."
    : "Une erreur est survenue lors de la connexion.";
  return (
    <main className="page p-6 max-w-lg mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">Connexion refusée</h1>
      <p className="mb-4">{msg}</p>
      <Link className="btn" href="/login">Retour</Link>
    </main>
  );
}
AuthErrorPage.getInitialProps = ({ query }) => ({ query });