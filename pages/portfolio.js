import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import PerfBadge from "../components/PerfBadge";
import { TableSkeleton } from "../components/Skeletons";

/* ---------- Helpers pour l'historique ---------- */
function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function toIsoStartOfDay(localDateStr) {
  return new Date(localDateStr + "T00:00:00.000Z").toISOString();
}
function toIsoEndOfDay(localDateStr) {
  return new Date(localDateStr + "T23:59:59.999Z").toISOString();
}

function OrdersHistory() {
  const today = useMemo(() => new Date(), []);
  const d30 = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000), []);
  const [from, setFrom] = useState(fmtDateInput(d30));
  const [to, setTo] = useState(fmtDateInput(today));
  const [side, setSide] = useState("ALL");

  const [rows, setRows] = useState(null); // null=loading, []=vide
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      setRows(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", toIsoStartOfDay(from));
        if (to)   params.set("to", toIsoEndOfDay(to));
        if (side !== "ALL") params.set("side", side);
        params.set("limit", "500");

        const r = await fetch(`/api/orders?${params.toString()}`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[orders][ui] fetch err:", e);
        if (alive) { setErr("Impossible de charger l’historique d’ordres"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, [from, to, side]);

  const safeRows = Array.isArray(rows) ? rows : [];
  const hasRows = safeRows.length > 0;

  return (
    <section className="mt-10 w-full max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-2xl font-semibold">Historique d’ordres</h2>
        <div className="flex items-end gap-2">
          <label className="form-control">
            <span className="label-text">Depuis</span>
            <input
              type="date"
              className="input input-bordered"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Jusqu’au</span>
            <input
              type="date"
              className="input input-bordered"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Sens</span>
            <select
              className="select select-bordered"
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="ALL">Tous</option>
              <option value="BUY">Achats</option>
              <option value="SELL">Ventes</option>
            </select>
          </label>

          {/* Bouton CSV */}
          <a
            className="btn btn-outline"
            href={`/api/orders?from=${encodeURIComponent(toIsoStartOfDay(from))}&to=${encodeURIComponent(toIsoEndOfDay(to))}${side!=="ALL" ? `&side=${side}`:""}&format=csv`}
            target="_blank" rel="noopener noreferrer"
          >
            Export CSV
          </a>
        </div>
      </div>

      {err && <div className="alert alert-warning mb-3">{err}</div>}

      {rows === null ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Symbole</th><th>Sens</th><th>Qté</th><th>Prix (EUR)</th><th>Frais (EUR)</th><th>Total net (EUR)</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton h-4 w-32 rounded" /></td>
                  <td><div className="skeleton h-4 w-16 rounded" /></td>
                  <td><div className="skeleton h-4 w-14 rounded" /></td>
                  <td><div className="skeleton h-4 w-10 rounded" /></td>
                  <td><div className="skeleton h-4 w-16 rounded" /></td>
                  <td><div className="skeleton h-4 w-16 rounded" /></td>
                  <td><div className="skeleton h-4 w-16 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasRows ? (
        <div className="text-gray-500">Aucun ordre sur la période.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbole</th>
                <th>Sens</th>
                <th>Quantité</th>
                <th>Prix (EUR)</th>
                <th>Frais (EUR)</th>
                <th>Total net (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((o) => {
                const qty        = Number(o.quantity || 0);

                const priceEURApi = Number(o.priceEUR);
                const totalEURApi = Number(o.totalEUR);
                const feeEUR      = Number(o.feeEUR || 0);

                const priceNative  = Number(o.price || 0);
                const rate         = Number(o.rateToEUR || 1);
                const priceEUR     =
                  (Number.isFinite(priceEURApi) && priceEURApi > 0)
                    ? priceEURApi
                    : priceNative * (Number.isFinite(rate) && rate > 0 ? rate : 1);

                const gross        = priceEUR * qty;
                const totalEUR     =
                  (Number.isFinite(totalEURApi) && totalEURApi !== 0)
                    ? totalEURApi
                    : (o.side === "BUY" ? (gross + feeEUR) : (gross - feeEUR));

                return (
                  <tr key={o.id}>
                    <td>{new Date(o.createdAt).toLocaleString("fr-FR")}</td>
                    <td className="flex items-center gap-2">
                      {o.symbol}
                      <span className="badge badge-ghost">
                        {(o.currency || "EUR")}
                        {o.currency && o.currency !== "EUR"
                          ? `→EUR≈${Number(o.rateToEUR || 1).toFixed(4)}`
                          : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${o.side === "BUY" ? "badge-success" : "badge-error"}`}>
                        {o.side}
                      </span>
                    </td>
                    <td>{qty}</td>
                    <td>{priceEUR.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} €</td>
                    <td>{feeEUR.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                    <td>{totalEUR.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Page portefeuille ---------- */
export default function Portfolio() {
  const [data, setData] = useState({ positions: [], cash: 0, positionsValue: 0, equity: 0 });
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
        if (alive) {
          setErr("Impossible de charger le portefeuille");
          setData({ positions: [], cash: 0, positionsValue: 0, equity: 0 });
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = Array.isArray(data?.positions) ? data.positions : [];
  const cash = Number(data?.cash ?? 0);
  const positionsValue = Number(data?.positionsValue ?? 0);
  const equity = Number.isFinite(Number(data?.equity)) ? Number(data.equity) : positionsValue + cash;

  // coût en EUR (utilise avgPriceEUR renvoyé par l’API)
  const cost = rows.reduce((s, p) => s + Number(p.avgPriceEUR || 0) * Number(p.quantity || 0), 0);
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
              {positionsValue.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Cash</div>
            <div className="stat-value">
              {cash.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Équity totale</div>
            <div className="stat-value">
              {equity.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">% Perf (vs. coût)</div>
            <div className="stat-value"><PerfBadge value={pnlPct} /></div>
          </div>
        </div>

        {err && <div className="alert alert-warning mb-4">{err}</div>}

        {rows.length === 0 ? (
          <div className="mt-4 text-gray-500">Aucune position pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Symbole</th>
                  <th>Nom</th>
                  <th>Qté</th>
                  <th>Prix moyen (EUR)</th>
                  <th>Dernier (EUR)</th>
                  <th>P&L %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const q   = Number(p.quantity || 0);
                  const avg = Number(p.avgPriceEUR || 0); // EUR
                  const last= Number(p.lastEUR || 0);     // EUR
                  const pnlPctRow = (avg > 0 && Number.isFinite(last))
                    ? ((last - avg) / avg) * 100
                    : 0;
                  return (
                    <tr key={p.symbol || i}>
                      <td>{p.symbol}</td>
                      <td className="flex items-center gap-2">
                        {p.name || "—"}
                        <span className="badge badge-ghost">
                          {p.currency || "EUR"}{p.currency && p.currency !== "EUR" ? `→EUR≈${Number(p.rateToEUR||1).toFixed(4)}` : ""}
                        </span>
                      </td>
                      <td>{q}</td>
                      <td>{avg ? `${avg.toFixed(2)} €` : "—"}</td>
                      <td>{Number.isFinite(last) && last > 0 ? `${last.toFixed(2)} €` : "—"}</td>
                      <td><PerfBadge value={p.pnlPct ?? pnlPctRow} compact /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- Historique d’ordres --- */}
        <OrdersHistory />
      </main>
    </div>
  );
}