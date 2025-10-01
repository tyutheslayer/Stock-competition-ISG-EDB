import { useEffect, useMemo, useRef, useState } from "react";

/* ---- Utils formatting ---- */
export function formatEUR(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits });
}
export function formatSignedEUR(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "−";
  return `${s}${formatEUR(Math.abs(n), digits)}`;
}
export function formatPct(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/* ---- Symbol helpers ---- */
function parseExtSymbolFront(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts.length < 2) return { base, kind: "SPOT" };
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase(); // LONG | SHORT
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  if (parts[1] === "OPT") {
    const side = (parts[2] || "").toUpperCase(); // CALL | PUT
    return { base, kind: "OPT", side, lev: 1 };
  }
  return { base, kind: "SPOT" };
}

/* ---- PnL calc (clair) ----
   - LEV: pnlNotional = (last - avg) * qty * dir
          margin = (avg * qty) / lev
          pnl%notional = pnlNotional / (avg*qty)
          pnl%margin   = pnlNotional / margin
   - OPT: intrinsic = max(0, last - avg)*qty (CALL) ou max(0, avg - last)*qty (PUT)
          NB: hors prime (déjà payée à l’ouverture)
*/
function computePlusPnl(row, lastPriceEUR) {
  const meta = parseExtSymbolFront(row.symbol);
  const qty = Number(row.quantity || 0);
  const avg = Number(row.avgPrice || NaN);
  const last = Number(lastPriceEUR || NaN);
  if (!Number.isFinite(qty) || !Number.isFinite(avg) || !Number.isFinite(last) || qty <= 0) {
    return { kind: meta.kind, pnlEUR: NaN, pnlNotionalPct: NaN, pnlOnMarginPct: NaN, marginEUR: NaN, notionalEUR: NaN, side: meta.side, lev: meta.lev };
  }

  if (meta.kind === "LEV") {
    const dir = (meta.side === "SHORT") ? -1 : 1;
    const pnlEUR = (last - avg) * qty * dir;                  // PnL sur le notional (logique CFD)
    const notionalEUR = avg * qty;
    const marginEUR = notionalEUR / (meta.lev || 1);
    const pnlNotionalPct = pnlEUR / notionalEUR;              // % vs notional
    const pnlOnMarginPct = marginEUR > 0 ? pnlEUR / marginEUR : NaN; // % vs marge (parlant)
    return { kind: "LEV", pnlEUR, pnlNotionalPct, pnlOnMarginPct, marginEUR, notionalEUR, side: meta.side, lev: meta.lev };
  }

  if (meta.kind === "OPT") {
    const intrinsic = (meta.side === "CALL")
      ? Math.max(0, last - avg) * qty
      : Math.max(0, avg - last) * qty;
    // Ici on n’intègre pas la prime (déjà débitée à l’ouverture)
    // On expose donc “intrinsèque reçu si close maintenant”
    return { kind: "OPT", pnlEUR: intrinsic, pnlNotionalPct: NaN, pnlOnMarginPct: NaN, marginEUR: NaN, notionalEUR: avg * qty, side: meta.side, lev: 1 };
  }

  return { kind: "SPOT", pnlEUR: NaN, pnlNotionalPct: NaN, pnlOnMarginPct: NaN, marginEUR: NaN, notionalEUR: NaN, side: meta.side, lev: meta.lev };
}

function parseShort(symbol) {
  const s = String(symbol || "");
  const isUS = /\.|:/.test(s) ? false : /^[A-Z.\-]{1,6}$/.test(s);
  if (isUS) return { label: s, tv: s };
  if (s.endsWith(".PA")) return { label: `${s.replace(".PA", "")} • Paris`, tv: s };
  return { label: s, tv: s };
}

export default function PlusPositionsCard({ rows, quotesByBase, onClose, onCloseAll, refreshing, onRefresh }) {
  // pour les quantités de fermeture partielle
  const [qtyMap, setQtyMap] = useState({}); // { id: "3" }
  const [busy, setBusy] = useState(null);   // id en cours de fermeture

  function Row({ p }) {
    const idStr = p?.id != null ? String(p.id) : "";
    const meta = parseExtSymbolFront(p.symbol);
    const base = meta.base;
    const last = quotesByBase?.[base]?.priceEUR ?? quotesByBase?.[base]?.price ?? NaN;
    const pnl = computePlusPnl(p, last);
    const short = parseShort(base);

    const pnlClass = Number(pnl.pnlEUR) >= 0 ? "text-green-600" : "text-red-600";
    const badgeKind =
      pnl.kind === "LEV"
        ? "badge-info"
        : pnl.kind === "OPT"
        ? "badge-warning"
        : "badge-ghost";

    return (
      <tr key={idStr || p.symbol}>
        <td className="align-top">
          <div className="font-medium">{short.label}</div>
          <div className="text-xs opacity-60">{p.symbol}</div>
        </td>

        <td className="align-top">
          <div className={`badge ${badgeKind} mr-2`}>{pnl.kind}</div>
          {pnl.kind === "LEV" && <span className="badge">{meta.side} {meta.lev}x</span>}
          {pnl.kind === "OPT" && <span className="badge">{meta.side}</span>}
        </td>

        <td className="align-top">{p.quantity}</td>
        <td className="align-top">{Number(p.avgPrice).toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
        <td className="align-top">{Number.isFinite(last) ? last.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : "…"}</td>

        <td className={`align-top ${pnlClass}`}>
          <div className="font-semibold">{formatSignedEUR(pnl.pnlEUR)}</div>
          {pnl.kind === "LEV" && (
            <div className="text-xs opacity-70">
              {`Notional ${formatEUR(pnl.notionalEUR)} · Marge ${formatEUR(pnl.marginEUR)}`}<br/>
              {`Δ ${formatPct(pnl.pnlNotionalPct)} notional / ${formatPct(pnl.pnlOnMarginPct)} marge`}
            </div>
          )}
          {pnl.kind === "OPT" && (
            <div className="text-xs opacity-70">
              Intrinsèque (hors prime)
            </div>
          )}
        </td>

        <td className="align-top">
          <div className="flex items-center gap-2">
            <input
              className="input input-bordered w-24"
              type="number"
              min={1}
              max={p.quantity}
              placeholder="Qté"
              value={idStr ? (qtyMap[idStr] ?? "") : ""}
              onChange={(e) => idStr && setQtyMap(prev => ({ ...prev, [idStr]: e.target.value }))}
              disabled={busy === idStr}
            />
            <button className={`btn btn-outline btn-sm ${busy === idStr ? "btn-disabled" : ""}`}
              onClick={async ()=>{
                setBusy(idStr);
                try {
                  await onClose?.(p, qtyMap[idStr] ? Number(qtyMap[idStr]) : undefined);
                  setQtyMap(prev => ({ ...prev, [idStr]: "" }));
                } finally {
                  setBusy(null);
                }
              }}>
              {busy === idStr ? "…" : "Couper"}
            </button>
            <button className={`btn btn-error btn-sm ${busy === idStr ? "btn-disabled" : ""}`}
              onClick={async ()=>{
                setBusy(idStr);
                try {
                  await onCloseAll?.(p);
                } finally {
                  setBusy(null);
                }
              }}>
              {busy === idStr ? "…" : "Tout fermer"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="mt-6 p-4 rounded-2xl shadow bg-base-100">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Positions EDB Plus</h4>
        <button className={`btn btn-sm ${refreshing ? "btn-disabled" : "btn-outline"}`} onClick={onRefresh}>
          {refreshing ? "…" : "Rafraîchir"}
        </button>
      </div>

      {(!rows || rows.length === 0) ? (
        <div className="mt-3 text-sm opacity-70">Aucune position à effet de levier / option ouverte.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Symbole</th>
                <th>Type</th>
                <th>Qté / Prix</th>
                <th>Entrée (€)</th>
                <th>Dernier (€)</th>
                <th>PnL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => <Row key={p.id ?? p.symbol} p={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}