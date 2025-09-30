// pages/checkout/cancel.jsx
import Head from "next/head";
import Link from "next/link";
import NavBar from "../../components/NavBar";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";


export default function CheckoutCancel() {
  return (
    <>
      <Head>
        <title>Paiement annulé – EDB Plus</title>
      </Head>
      <div className="min-h-screen bg-base-100">
        <NavBar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-3xl font-bold">Paiement annulé</h1>
          <p className="mt-4 opacity-80">
            Ton paiement a été annulé. Tu peux réessayer à tout moment.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/plus" className="btn btn-primary">Retour à EDB Plus</Link>
            <Link href="/" className="btn btn-ghost">Accueil</Link>
          </div>
        </main>
      </div>
    </>
  );
}