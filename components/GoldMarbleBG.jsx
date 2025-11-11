//components/GoldMarbleBG.jsx
import { useEffect, useRef } from "react";

export default function GoldMarbleBG() {
  const ref = useRef(null);

  useEffect(() => {
    // Preload (non bloquant)
    const img = new Image();
    img.src = "/images/marble-gold.jpg";
    img.decode?.().catch(() => {});

    // Reflets or qui suivent la souris
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      el.style.setProperty("--mx", String(x));
      el.style.setProperty("--my", String(y));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <>
      {/* Calque marble: z-0 (pas négatif) pour rester visible sous le contenu (qui est z-10) */}
      <div
        ref={ref}
        className="plus-bg"
        aria-hidden="true"
        style={{ backgroundImage: 'url("/images/marble-gold.jpg")' }} // inline aussi (chemin garanti)
      />
      {/* Vignette douce pour le contraste du contenu */}
      <div className="plus-vignette" aria-hidden="true" />
    </>
  );
}