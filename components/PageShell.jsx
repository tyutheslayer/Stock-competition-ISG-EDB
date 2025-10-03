import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";
import { useEffect } from "react";

export default function PageShell({ children, className = "" }) {
  // ✅ Auto-thèmes : octobre = pink, décembre = gold
  useEffect(() => {
    const el = document.documentElement;
    const month = new Date().getMonth(); // 0 = janv ... 9 = oct, 11 = déc

    // on retire d’abord d’éventuelles classes theme- déjà présentes
    el.classList.forEach((c) => c.startsWith("theme-") && el.classList.remove(c));

    if (month === 10) {
      // Octobre
      el.classList.add("theme-pink");
    } else if (month === 9) {
      // Décembre
      el.classList.add("theme-gold");
    }
    // sinon, thème par défaut (variables :root)
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
    </div>
  );
}