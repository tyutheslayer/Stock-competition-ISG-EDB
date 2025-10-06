// components/PageShell.jsx
import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";
import { useEffect, useState } from "react";

export default function PageShell({ children, className = "" }) {
  const [logoSrc, setLogoSrc] = useState("/logo_ecole_bourse_transparent_clean.png");

  // ✅ Auto-thèmes : octobre = pink, décembre = gold
  useEffect(() => {
    const el = document.documentElement;
    // retire d’éventuelles classes theme- déjà présentes
    el.classList.forEach((c) => c.startsWith("theme-") && el.classList.remove(c));

    const month = new Date().getMonth(); // 0=janv … 9=oct, 11=déc
    if (month === 9) {
      el.classList.add("theme-pink");
      setLogoSrc("/logo_octobre_rose_clean.png");
    } else if (month === 11) {
      el.classList.add("theme-gold");
      setLogoSrc("/logo_ecole_bourse_transparent_clean.png");
    } else {
      setLogoSrc("/logo_ecole_bourse_transparent_clean.png");
    }
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Couche dégradée SOUS la 3D */}
      <div className="app-gradient" />

      {/* 3D : masqué en mobile, non cliquable */}
      <div className="hidden md:block">
        <NeonBackground3D className="-z-20 pointer-events-none" />
      </div>

      {/* Contenu */}
      <header className="relative z-10">
        <NavBar />
      </header>

      <main
        className={clsx(
          // paddings un peu plus compacts en mobile
          "relative z-10 max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6",
          className
        )}
      >
        {children}
      </main>

      {/* ✅ Logo discret en filigrane (bas à droite) */}
      <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 z-0 opacity-20 pointer-events-none select-none">
        <img
          src={logoSrc}
          alt="Logo EDB"
          className="w-14 md:w-24 lg:w-28"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}