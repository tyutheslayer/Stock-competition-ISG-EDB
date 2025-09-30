// pages/checkout/success.jsx
import Head from "next/head";
import Link from "next/link";
import NavBar from "../../components/NavBar";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <PlusThemeProvider>
      <Component {...pageProps} />
    </PlusThemeProvider>
  );
}
export default function CheckoutSuccess() {
  return (
    <>
      <Head>
        <title>Paiement réussi – EDB Plus</title>
      </Head>
      <div className="min-h-screen bg-base-100">
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-3xl font-bold text-primary">Bienvenue dans EDB Plus 🎉</h1>
          <p className="mt-4 opacity-80">
            Ton paiement est confirmé. Si tu avais déjà un compte, ton accès sera activé très
            rapidement. Sinon, crée ton compte avec le même email que tu as utilisé au paiement.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/login" className="btn btn-primary">Se connecter</Link>
            <Link href="/calendar" className="btn btn-ghost">Voir le calendrier</Link>
          </div>
        </main>
      </div>
    </>
  );
}