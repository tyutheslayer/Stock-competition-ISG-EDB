import Link from "next/link";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import PerfBadge from "../components/PerfBadge";

export default function Home() {
  const [rows, setRows] = useState(null);   // null = loading, [] = vide, [...]=données
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/leaderboard");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (alive) setRows(Array.isArray(data) ? data.slice(0, 50) : []);
      } catch (e) {
        if (alive) { setErr("Impossible de charger le classement"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page flex flex-col items-center justify-center text-center py-10">
        <h1 className="text-4xl font-bold text-isg">Compétition d’investissement</h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          Participez à la simulation boursière de l’ISG : achetez et vendez des actions,
          suivez votre portefeuille et comparez vos performances avec vos camarades.
        </p>
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <Link className="btn bg-isg text-white" href="/register">Créer un compte</Link>
          <Link className="btn btn-outline" href="/login">Se connecter</Link>
          <Link className="btn btn-secondary" href="/trade">Aller trader</Link>
        </div>

        {/* --- Bloc Classement (Top 50) --- */}
        <section className="w-full max-w-5xl mt-12 text-left">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-semibold">Classement (Top 50)</h2>
            <Link className="link link-primary" href="/leaderboard">Voir tout</Link>
          </div>

          {/* Erreur éventuelle */}
          {err && <div className="alert alert-warning mb-3">{err}</div>}

          {/* Skeleton loader */}
          {rows === null && (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Joueur</th><th>Perf</th><th>Valeur</th></tr>
                </thead>
                <tbody>
                  {Array.from({length: 5}).map((_,i)=>(
                    <tr key={i}>
                      <td className="skeleton w-10 h-4 rounded"></td>
                      <td className="skeleton w-48 h-4 rounded"></td>
                      <td className="skeleton w-20 h-4 rounded"></td>
                      <td className="skeleton w-24 h-4 rounded"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tableau réel */}
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
                    // Adapte ces champs si ton /api/leaderboard renvoie d'autres noms :
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
                      <tr key={row.id ?? row.email ?? i}>
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

          {/* Aucun joueur */}
          {Array.isArray(rows) && rows.length === 0 && (
            <div className="mt-4 text-gray-500">Aucun joueur pour le moment.</div>
          )}
        </section>
      </main>
    </div>
  );
}
