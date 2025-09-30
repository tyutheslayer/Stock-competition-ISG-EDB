// components/PlusOnly.jsx
import { useEffect, useState } from "react";

export default function PlusOnly({ children, fallback = null }) {
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setStatus(j?.status || "none");
      } catch {
        if (alive) setStatus("none");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (status === "loading") {
    return (
      <div className="rounded-xl p-3 bg-base-200/50 text-sm opacity-70">
        Chargement du statut EDB Plus…
      </div>
    );
  }
  if (status !== "active") {
    return (
      fallback || (
        <div className="rounded-xl p-4 bg-base-200/50">
          <div className="font-medium">Fonction réservée à EDB Plus</div>
          <div className="text-sm opacity-70">
            Active EDB Plus pour débloquer l’outil avancé de trading, options, et graphiques enrichis.
          </div>
        </div>
      )
    );
  }
  return children;
}