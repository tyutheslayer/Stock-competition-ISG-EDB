/* ---------- Positions EDB Plus ---------- */
function PositionsPlusPane() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [qClose, setQClose] = useState({});
  const [toast, setToast] = useState(null);
  const [quotes, setQuotes] = useState({}); // {BASE: {priceEUR,...}}

  async function fetchPositions() {
    // on se base UNIQUEMENT sur l’endpoint dédié (retourne id à coup sûr)
    const r = await fetch(`/api/positions-plus?t=${Date.now()}`);
    if (!r.ok) return [];
    const j = await r.json().catch(() => []);
    return Array.isArray(j) ? j : [];
  }

  async function refresh() {
    setLoading(true);
    try {
      const arr = await fetchPositions();
      setRows(arr);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function onKick() { refresh(); }
    window.addEventListener("positions-plus:refresh", onKick);
    return () => window.removeEventListener("positions-plus:refresh", onKick);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function poll() {
      const baseSyms = Array.from(
        new Set(
          rows
            .map(r => parseExtSymbolFront(r.symbol).base)
            .filter(Boolean)
        )
      );
      if (baseSyms.length === 0) return;
      try {
        const next = {};
        for (const s of baseSyms) {
          const rq = await fetch(`/api/quote/${encodeURIComponent(s)}`);
          if (!rq.ok) continue;
          const q = await rq.json();
          next[s] = q;
        }
        if (alive) setQuotes(next);
      } catch {}
    }

    poll();
    timer = setInterval(poll, 12000);
    return () => { alive = false; timer && clearInterval(timer); };
  }, [rows]);

  useEffect(() => {
    let alive = true;
    let t = null;
    (async () => { await refresh(); })();
    t = setInterval(() => alive && refresh(), 20000);
    return () => { alive = false; t && clearInterval(t); };
  }, []);

  // récupère l'id manquant en dernier recours
  async function ensureIdForSymbol(symbol) {
    try {
      const list = await fetchPositions();
      const found = list.find(x => String(x.symbol) === String(symbol));
      return found?.id ?? null;
    } catch { return null; }
  }

  async function closeOne(p, qtyOverride) {
    let pid = getPlusId(p);
    const pidStr = pid != null ? String(pid) : null;
    const qty = Number(qtyOverride ?? (pidStr ? qClose[pidStr] : 0) ?? 0) || undefined;

    // si pas d'id, on le récupère en live via /api/positions-plus
    if (!pidStr) {
      const rescued = await ensureIdForSymbol(p.symbol);
      if (!rescued) {
        return setToast({ ok: false, text: "❌ POSITION_ID_REQUIRED" });
      }
      pid = rescued;
    }

    setLoadingId(String(pid));
    try {
      const r = await fetch(`/api/close-plus?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: pid,          // on envoie l'id brut (nombre)
          quantity: qty,            // undefined => tout fermer
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j?.error || j?.message || `Fermeture échouée (${r.status})`;
        return setToast({ ok: false, text: `❌ ${msg}` });
      }
      setToast({ ok: true, text: `✅ Position fermée${(j?.closedQty || qty) ? ` (${j?.closedQty || qty})` : ""}` });
      await refresh();
    } catch {
      setToast({ ok: false, text: "❌ Erreur réseau" });
    } finally {
      setLoadingId(null);
    }
  }

  function pnlCell(p) {
    const meta = parseExtSymbolFront(p.symbol);
    const q = quotes[meta.base];
    const last = Number(q?.priceEUR ?? q?.price ?? NaN);
    const qty = Number(p?.quantity ?? 0);
    const avg = Number(p?.avgPrice ?? NaN);
    if (!Number.isFinite(last) || !Number.isFinite(avg) || !Number.isFinite(qty)) return "—";
    const dir = (String(meta.side || "").toUpperCase() === "SHORT") ? -1 : 1;
    const pnl = (last - avg) * qty * (meta.kind === "LEV" ? dir : 1) * (meta.side === "PUT" ? -1 : 1);
    const cls = pnl >= 0 ? "text-green-600" : "text-red-600";
    return <span className={cls}>{pnl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</span>;
  }

  return (
    <div className="mt-6 p-4 rounded-2xl shadow bg-base-100">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Positions EDB Plus</h4>
        <button className={`btn btn-sm ${loading ? "btn-disabled" : "btn-outline"}`} onClick={refresh}>
          {loading ? "…" : "Rafraîchir"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm opacity-70">Aucune position à effet de levier / option ouverte.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Symbole</th>
                <th>Type</th>
                <th>Side</th>
                <th>Qté</th>
                <th>Prix moy. (€)</th>
                <th>Dernier (€)</th>
                <th>PnL latent</th>
                <th>Couper</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const meta = parseExtSymbolFront(p.symbol);
                const pidStr = p?.id != null ? String(p.id) : "";
                const t = meta.kind === "LEV" ? "LEVERAGED" : (meta.kind === "OPT" ? "OPTION" : "SPOT");
                const last = Number(quotes[meta.base]?.priceEUR ?? quotes[meta.base]?.price ?? NaN);
                const short = parseShort(meta.base);

                return (
                  <tr key={pidStr || `${p.symbol}-${p.avgPrice}-${p.quantity}`}>
                    <td>
                      {short.label}
                      <div className="text-xs opacity-60">
                        {t === "LEVERAGED" ? `${meta.side} ${meta.lev}x` : t === "OPTION" ? `${meta.side}` : "SPOT"}
                      </div>
                      {!pidStr && <div className="text-xs opacity-60">ID en cours de résolution…</div>}
                    </td>
                    <td>{t}</td>
                    <td>{String(meta.side || "—")}</td>
                    <td>{p.quantity}</td>
                    <td>{Number(p.avgPrice).toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                    <td>{Number.isFinite(last) ? last.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : "…"}</td>
                    <td>{pnlCell(p)}</td>
                    <td className="flex items-center gap-2">
                      <input
                        className="input input-bordered w-24"
                        type="number"
                        min={1}
                        max={p.quantity}
                        placeholder="Qté"
                        value={pidStr ? (qClose[pidStr] ?? "") : ""}
                        onChange={(e) => pidStr && setQClose((prev) => ({ ...prev, [pidStr]: e.target.value }))}
                        disabled={loadingId === pidStr}
                      />
                      <button
                        className={`btn btn-outline ${loadingId === pidStr ? "btn-disabled" : ""}`}
                        onClick={() => closeOne(p)}
                      >
                        {loadingId === pidStr ? "…" : "Couper"}
                      </button>
                      <button
                        className={`btn btn-error ${loadingId === pidStr ? "btn-disabled" : ""}`}
                        onClick={() => closeOne(p, p.quantity)}
                      >
                        {loadingId === pidStr ? "…" : "Tout fermer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`alert mt-3 ${toast.ok ? "alert-success" : "alert-error"}`}>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}