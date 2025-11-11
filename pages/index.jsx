//pages/index.jsx
import Head from "next/head";
import PageShell from "../components/PageShell";
import Hero from "../components/Hero";
import FeatureGrid from "../components/FeatureGrid";
import PricingPlans from "../components/PricingPlans";
import CTA from "../components/CTA";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import { getToken } from "next-auth/jwt";

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

      <PageShell>
        <main className="flex-1 pt-2 md:pt-0">
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

export async function getServerSideProps({ req }) {
  // Lit le JWT NextAuth côté serveur, sans authOptions
  const token = await getToken({
    req,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const role = token?.role || null;
  const isPlus =
    token?.isPlusActive === true ||
    token?.plusStatus === "active" ||
    role === "ADMIN";

  if (isPlus) {
    return { redirect: { destination: "/plus", permanent: false } };
  }
  return { props: {} };
}