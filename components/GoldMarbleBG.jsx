// components/GoldMarbleBG.jsx
import { useEffect, useRef } from "react";

//Fond marbre + reflets or qui suivent la souris.fixe derrière tout le contenu,aucun événement bloqué (pointer-events: none),fonctionne seulement quand data-theme="plus"

export default function GoldMarbleBG() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Position initiale centrée
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");

    const onMove = (e) => {
      // récupère position relative [0..1]
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const x = Math.max(0, Math.min(1, e.clientX / vw));
      const y = Math.max(0, Math.min(1, e.clientY / vh));

      // convertit en %
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="plus-marble-bg fixed inset-0 -z-20 pointer-events-none"
    />
  );
}