import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import PerfBadge from "../components/PerfBadge";
import { TableSkeleton } from "../components/Skeletons";

export default function Portfolio() {
  const [data, setData] = useState(null); // { positions, cash, positionsValue, equity }
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/portfolio");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (alive) setData(j);
      } catch (e) {
        if (alive) { setErr("Impossible de charger le portefeuille"); setData({ positions: [], cash: 0, positionsValue: 0, equity: 0 }); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = data?.positions || [];
  const cash = data?.cash ?? 0;
  const positionsValue = data?.positionsValue ?? 0;
  const equity = data?.equity ?? positionsValue + cash;
  const cost = rows.reduce((s, p) => s + Number(p.avgPrice || 0) * Number(p.quantity || 0), 0);
  const pnl   = positionsValue - cost;
  const pnlPct= cost > 0 ? (pnl / cost) * 100 : 0;

  return (
    <div>
      <NavBar />
      <main className="page p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-primary mb-4">Portefeuille</h1>

        {/* KPIs */}
        <div className="stats shadow w-full mb-6">
          <div className="stat">
            <div className="stat-title">Valorisation actions</div>
            <div className="stat-value">
              {data === null ? "…" : positionsValue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Cash</div>
            <div className="stat-value">
              {data === null ? "…" : cash.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Équity totale</div>
            <div className="stat-value">
              {data === null ? "…" : equity.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">% Perf (vs. coût)</div>
            <div className="stat-value"><PerfBadge value={pnlPct} /></div>
          </div>
        </div>

        {err && <div className="alert alert-warning mb-4">{err}</div>}

        {data === null && <TableSkeleton rows={6} cols={6} />}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Symbole</th>
                  <th>Nom</th>
                  <th>Qté</th>
                  <th>Prix moyen</th>
                  <th>Dernier</th>
                  <th>P&L %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const q   = Number(p.quantity || 0);
                  const avg = Number(p.avgPrice || 0);
                  const last= Number(p.last || 0);
                  const pnlPctRow = avg > 0 ? ((last - avg) / avg) * 100 : 0;
                  return (
                    <tr key={p.symbol || i}>
                      <td>{p.symbol}</td>
                      <td>{p.name || "—"}</td>
                      <td>{q}</td>
                      <td>{avg ? avg.toFixed(2) : "—"}</td>
                      <td>{Number.isFinite(last) && last > 0 ? last.toFixed(2) : "—"}</td>
                      <td><PerfBadge value={p.pnlPct ?? pnlPctRow} compact /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && rows.length === 0 && (
          <div className="mt-4 text-gray-500">Aucune position pour le moment.</div>
        )}
      </main>
    </div>
  );
}
