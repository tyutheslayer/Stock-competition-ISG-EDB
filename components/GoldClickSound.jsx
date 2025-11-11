import { useEffect } from "react";

export default function GoldClickSound({ active = false }) {
  useEffect(() => {
    if (!active) return;

    const audio = new Audio("/sounds/click-gold.mp3");
    audio.volume = 0.25; // très doux

    const play = () => {
      const a = audio.cloneNode();
      a.play().catch(() => {}); // évite les erreurs navigateur
    };

    // écoute tous les clics sur boutons
    const handler = (e) => {
      const btn = e.target.closest(".btn");
      if (btn) play();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [active]);

  return null;
}