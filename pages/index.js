// pages/index.js
import NavBar from "../components/NavBar";
import Hero from "../components/Hero";
import FeatureGrid from "../components/FeatureGrid";
import PricingPlans from "../components/PricingPlans";
import CTA from "../components/CTA";

export default function HomePage() {
  return (
    <div>
      <NavBar />
      <main>
        <Hero />
        <FeatureGrid />
        <PricingPlans />
        <CTA />
      </main>
    </div>
  );
}