// pages/index.js
import Link from "next/link";
import { useEffect, useState } from "react";
import PerfBadge from "../components/PerfBadge";
import PageShell from "../components/PageShell";
import GlassPanel from "../components/GlassPanel";

export default function Home() {
  const [rows, setRows] = useState(null);   // null = loading, [] = vide, [...]=données
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/leaderboard?limit=50&offset=0");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        // accepte l'ancien format (tableau) ou le nouveau ({rows,...})
        const list = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
        if (alive) setRows(list.slice(0, 50));
      } catch (e) {
        if (alive) { setErr("Impossible de charger le classement"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        {/* Hero */}
        <section className="col-span-12">
          <GlassPanel className="text-center">
            <h1 className="text-4xl font-bold">Compétition d’investissement</h1>
            <p className="mt-4 max-w-2xl mx-auto opacity-80">
              Participez à la simulation boursière de l’ISG : achetez et vendez des actions,
              suivez votre portefeuille et comparez vos performances avec vos camarades.
            </p>
            <div className="mt-6 flex gap-3 flex-wrap justify-center">
              <Link className="btn btn-primary" href="/register">Créer un compte</Link>
              <Link className="btn btn-outline" href="/login">Se connecter</Link>
              <Link className="btn btn-secondary" href="/trade">Aller trader</Link>
            </div>
          </GlassPanel>
        </section>

        {/* Classement (Top 50) */}
        <section className="col-span-12">
          <GlassPanel>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">Classement (Top 50)</h2>
              <Link className="link link-primary" href="/leaderboard">Voir tout</Link>
            </div>

            {err && <div className="alert alert-warning mb-3">{err}</div>}

            {rows === null && (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Joueur</th><th>Perf</th><th>Valeur</th></tr>
                  </thead>
                  <tbody>
                    {Array.from({length: 5}).map((_,i)=>(
                      <tr key={i}>
                        <td><div className="skeleton w-10 h-4 rounded" /></td>
                        <td><div className="skeleton w-48 h-4 rounded" /></td>
                        <td><div className="skeleton w-20 h-4 rounded" /></td>
                        <td><div className="skeleton w-24 h-4 rounded" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(rows) && rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Joueur</th>
                      <th>Perf</th>
                      <th>Valeur totale (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const rank = row.rank ?? i + 1;
                      const name = row.name ?? row.displayName ?? row.email ?? "—";
                      const perfPct =
                        row.perfPct ??
                        row.returnPct ??
                        row.pnlPct ??
                        (typeof row.perf === "number" ? row.perf * 100 : null);
                      const equity =
                        typeof row.equity === "number" ? row.equity :
                        typeof row.total === "number" ? row.total :
                        null;

                      return (
                        <tr key={row.userId ?? row.id ?? row.email ?? i}>
                          <td>{rank}</td>
                          <td>{name}</td>
                          <td><PerfBadge value={perfPct} /></td>
                          <td>{equity != null ? equity.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(rows) && rows.length === 0 && (
              <div className="mt-4 opacity-70">Aucun joueur pour le moment.</div>
            )}
          </GlassPanel>
        </section>
      </div>
    </PageShell>
  );
}