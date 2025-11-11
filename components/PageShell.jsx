// components/PageShell.jsx
import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import GoldMarbleBG from "./GoldMarbleBG";

export default function PageShell({ children, className = "" }) {
  const { data: session } = useSession();

  // ✅ Considère “Plus” si l’utilisateur a isPlusActive OU s’il est ADMIN
  const isPlus = useMemo(() => {
    const u = session?.user || {};
    return Boolean(u.isPlusActive || u.role === "ADMIN");
  }, [session?.user]);

  const [logoSrc, setLogoSrc] = useState("/logo_ecole_bourse_transparent_clean.png");

  // ✅ Auto-thèmes saisonniers (uniquement quand on N’EST PAS en mode Plus)
  useEffect(() => {
    const el = document.documentElement;
    // nettoie les anciennes classes theme-*
    el.classList.forEach((c) => c.startsWith("theme-") && el.classList.remove(c));

    if (isPlus) {
      // En mode Plus, on force le logo standard (fond marbre déjà orné)
      setLogoSrc("/logo_ecole_bourse_transparent_clean.png");
      return;
    }

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
  }, [isPlus]);

  return (
    // ⬇️ data-theme pilote plus-theme.css (plus / isg)
    <div className="relative min-h-screen" data-theme={isPlus ? "plus" : "isg"}>
      {/* Fond : marbre/or en mode Plus, sinon gradient + 3D */}
      {isPlus ? (
        // Fond marbre + reflets or interactifs
        <GoldMarbleBG />
      ) : (
        <>
          <div className="app-gradient" />
          <div className="hidden md:block">
            <NeonBackground3D className="-z-20 pointer-events-none" />
          </div>
        </>
      )}

      {/* Contenu */}
      <header className="relative z-10">
        <NavBar />
      </header>

      <main
        className={clsx(
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