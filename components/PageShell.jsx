import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";
import { useEffect, useState } from "react";

export default function PageShell({ children, className = "" }) {
  const [logoSrc, setLogoSrc] = useState("/logo_ecole_bourse_transparent_clean.png");

  // ✅ Auto-thèmes : octobre = pink, décembre = gold
  useEffect(() => {
    const el = document.documentElement;
    const month = new Date().getMonth(); // 0 = janv ... 9 = oct, 11 = déc

    // on retire d’abord d’éventuelles classes theme- déjà présentes
    el.classList.forEach((c) => c.startsWith("theme-") && el.classList.remove(c));

    if (month === 9) {
      // Octobre
      el.classList.add("theme-pink");
      setLogoSrc("/logo_octobre_rose_clean.png");
    } else if (month === 11) {
      // Décembre
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

      {/* 3D : sous le contenu et non cliquable */}
      <NeonBackground3D className="-z-20 pointer-events-none" />

      {/* Contenu */}
      <header className="relative z-10">
        <NavBar />
      </header>

      <main
        className={clsx(
          "relative z-10 max-w-[1280px] mx-auto px-5 md:px-6 py-6",
          className
        )}
      >
        {children}
      </main>

      {/* ✅ Logo discret en filigrane (bas à droite) */}
      <div className="absolute bottom-4 right-4 z-0 opacity-20 pointer-events-none">
        <img
          src={logoSrc}
          alt="Logo EDB"
          className="w-20 md:w-28 lg:w-32 select-none"
        />
      </div>
    </div>
  );
}