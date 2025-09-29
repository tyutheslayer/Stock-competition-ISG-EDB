// extrait à placer dans pages/plus.jsx, par ex. sous le <h1> principal
import { useEffect, useState } from "react";

function PlusStatusBadge() {
  const [status, setStatus] = useState("none");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setStatus(j?.status || "none");
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const map = {
    active: { label: "Actif", cls: "badge-success" },
    pending: { label: "En attente", cls: "badge-warning" },
    canceled: { label: "Annulé", cls: "badge-error" },
    none: { label: "Inactif", cls: "badge-ghost" },
  };
  const info = map[String(status).toLowerCase()] || map.none;

  return (
    <div className="my-2">
      <span className={`badge ${info.cls}`}>Statut EDB Plus : {info.label}</span>
    </div>
  );
}

export default PlusStatusBadge;