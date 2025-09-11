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
function buildCsvHref({ from, to, side }) {
  const p = new URLSearchParams();
  if (from) p.set("from", toIsoStartOfDay(from));
  if (to)   p.set("to", toIsoEndOfDay(to));
  if (side && side !== "ALL") p.set("side", side);
  p.set("format", "csv");
  return `/api/orders?${p.toString()}`;
}

function OrdersHistory() {
  // Par défaut : 30j, tous les sens
  const today = useMemo(() => new Date(), []);
  const d30 = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000), []);
  const [from, setFrom] = useState(fmtDateInput(d30));
  const [to, setTo] = useState(fmtDateInput(today));
  const [side, setSide] = useState("ALL"); // ALL | BUY | SELL

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

  const csvHref = buildCsvHref({ from, to, side });

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

          <form method="GET" action="/api/orders.csv" className="inline-flex" target="_blank">
            {from && <input type="hidden" name="from" value={toIsoStartOfDay(from)} />}
            {to   && <input type="hidden" name="to"   value={toIsoEndOfDay(to)} />}
            {side !== "ALL" && <input type="hidden" name="side" value={side} />}
            <button type="submit" className="btn btn-outline">
              Export CSV
            </button>
          </form>
        </div>
      </div>

      {err && <div className="alert alert-warning mb-3">{err}</div>}

      {rows === null ? (
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
                const avg = Number(p.avgPrice || 0);         // EUR
                const last= Number(p.lastEUR || 0);          // EUR
                const pnlPctRow = (avg > 0 && Number.isFinite(last))
                  ? ((last - avg) / avg) * 100
                  : 0;

                return (
                  <tr key={p.symbol || i}>
                    <td>{p.symbol}</td>
                    <td className="flex items-center gap-2">
                      {p.name || "—"}
                      {/* badge info devise */}
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
      ) : rows.length === 0 ? (
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
                <th>Prix</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const qty = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
                const price = typeof o.price === "number" ? o.price : Number(o.price);
                const total = (qty * price) || 0;
                return (
                  <tr key={o.id}>
                    <td>{new Date(o.createdAt).toLocaleString("fr-FR")}</td>
                    <td>{o.symbol}</td>
                    <td>
                      <span className={`badge ${o.side === "BUY" ? "badge-success" : "badge-error"}`}>
                        {o.side}
                      </span>
                    </td>
                    <td>{qty}</td>
                    <td>{price.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                    <td>{total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
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

/* ---------- Page portefeuille existante + ajout historique ---------- */
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

        {/* --- Historique d’ordres (nouveau) --- */}
        <OrdersHistory />
      </main>
    </div>
  );
}