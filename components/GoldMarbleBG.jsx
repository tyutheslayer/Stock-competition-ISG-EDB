// components/GoldMarbleBG.jsx
import { useEffect, useRef } from "react";

export default function GoldMarbleBG() {
  const ref = useRef(null);

  useEffect(() => {
    // Preload the marble image (non-blocking)
    const img = new Image();
    img.src = "/images/marble-gold.jpg";
    img.decode?.().catch(() => {});

    // Mouse-driven sheen
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
      {/* Base marble */}
      <div className="plus-bg" ref={ref} aria-hidden="true" />
      {/* Soft vignette so content pops */}
      <div className="plus-vignette" aria-hidden="true" />
    </>
  );
}