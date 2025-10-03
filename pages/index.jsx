// pages/index.jsx
import Head from "next/head";
import Hero from "../components/Hero";
import FeatureGrid from "../components/FeatureGrid";
import PricingPlans from "../components/PricingPlans";
import CTA from "../components/CTA";

export default function Home() {
  return (
    <>
      <Head>
        <title>École de la Bourse — Simule, apprends, progresse</title>
        <meta
          name="description"
          content="Entraîne-toi au trading sans risque, suis des mini-cours hebdomadaires gratuits et rejoins le classement. Passe au plan Pro pour accélérer tes progrès."
        />
        <meta property="og:title" content="École de la Bourse" />
        <meta
          property="og:description"
          content="Simule, apprends, progresse. Cours gratuits le jeudi 13h–13h30."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://stock-competition.vercel.app/" />
      </Head>

      {/* Le cadre (fond 3D + NavBar) vient de PageShell via _app.js */}
      <main className="flex-1">
        <Hero />

        <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-12">
          <FeatureGrid />
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
          <PricingPlans />
        </section>

        <section className="mt-16">
          <CTA />
        </section>
      </main>
    </>
  );
}