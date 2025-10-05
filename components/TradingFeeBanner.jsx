// components/TradingFeeBanner.jsx
import { useEffect, useState } from "react";

export default function TradingFeeBanner({ className = "" }) {
  const [bps, setBps] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const j = await r.json();
        if (alive) setBps(Number(j?.tradingFeeBps ?? 0));
      } catch {
        if (alive) setBps(0);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (bps === null) {
    return (
      <div className={`alert alert-info ${className}`}>
        <span>Chargement des frais…</span>
      </div>
    );
  }

  const pct = (bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  return (
    <div className={`rounded-xl bg-base-200/60 border border-base-300 px-4 py-3 text-sm ${className}`}>
      <div className="font-medium">Frais de trading</div>
      <div className="opacity-80">
        {pct}% par ordre (soit {bps} bps). Les frais sont intégrés au calcul du P&amp;L.
      </div>
    </div>
  );
}