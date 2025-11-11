// pages/index.jsx
import Head from "next/head";
import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import PageShell from "../components/PageShell";
import Hero from "../components/Hero";
import FeatureGrid from "../components/FeatureGrid";
import PricingPlans from "../components/PricingPlans";
import CTA from "../components/CTA";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isPlus = useMemo(() => {
    const u = session?.user || {};
    return u?.isPlusActive === true || u?.plusStatus === "active" || u?.role === "ADMIN";
  }, [session?.user]);

  // 🔁 Redirection client vers /plus si membre Plus/Admin
  useEffect(() => {
    if (status === "loading") return; // attendre l’état de session
    if (isPlus) router.replace("/plus");
  }, [isPlus, status, router]);

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

      {/* Pendant le chargement/redirect, on peut afficher un petit fallback neutre */}
      <PageShell>
        <main className="flex-1 pt-2 md:pt-0">
          {/* Si l’utilisateur est Plus, la redirection partira juste après le render */}
          <Hero />
          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-12">
            <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-xl">
              <div className="p-6 sm:p-10">
                <FeatureGrid />
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
            <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-xl">
              <div className="p-6 sm:p-10">
                <PricingPlans />
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
            <CTA />
          </section>
        </main>
      </PageShell>
    </>
  );
}