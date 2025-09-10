import { useEffect, useMemo, useRef, useState } from "react";
import PerfBadge from "./PerfBadge";

export default function WatchlistPane({ onPick }) {
  const [items, setItems] = useState(null);   // [{symbol,name,createdAt,rank}]
  const [quotes, setQuotes] = useState({});   // symbol -> { price, changePct }
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  // Tri d’affichage (indépendant de l’ordre persistant)
  const [sortKey, setSortKey] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");

  // Fallback universel : mode réorganiser (↑ / ↓)
  const [reorderMode, setReorderMode] = useState(false);

  function showToast(msg, kind = "success") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2000);
  }

  async function load() {
    try {
      const r = await fetch("/api/watchlist");
      if (!r.ok) throw new Error();
      const arr = await r.json();
      setItems(Array.isArray(arr) ? arr : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onChanged = () => load();
    if (typeof window !== "undefined") {
      window.addEventListener("watchlist:changed", onChanged);
      return () => window.removeEventListener("watchlist:changed", onChanged);
    }
  }, []);

  // Récup prix/var%
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    (async () => {
      const missing = items.filter(it => !quotes[it.symbol]);
      for (const it of missing) {
        try {
          const r = await fetch(`/api/quote/${encodeURIComponent(it.symbol)}`);
          const j = r.ok ? await r.json() : null;
          const price = Number(j?.price);
          const changePct = Number(j?.changePct);
          setQuotes(prev => ({
            ...prev,
            [it.symbol]: {
              price: Number.isFinite(price) ? price : null,
              changePct: Number.isFinite(changePct) ? changePct : null
            }
          }));
        } catch {
          setQuotes(prev => ({ ...prev, [it.symbol]: { price: null, changePct: null } }));
        }
      }
    })();
  }, [items]);

  // Filtre
  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const s = q.trim().toLowerCase();
    return s
      ? items.filter(it =>
          it.symbol.toLowerCase().includes(s) ||
          (it.name || "").toLowerCase().includes(s)
        )
      : items;
  }, [items, q]);

  // Vue triée (affichage)
  const view = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const qa = quotes[a.symbol] || {};
      const qb = quotes[b.symbol] || {};
      let va, vb;
      if (sortKey === "symbol") { va = a.symbol; vb = b.symbol; }
      else if (sortKey === "price") { va = qa.price ?? -Infinity; vb = qb.price ?? -Infinity; }
      else { va = qa.changePct ?? -Infinity; vb = qb.changePct ?? -Infinity; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, quotes, sortKey, sortDir]);

  async function quickOrder(symbol, side) {
    setBusy(symbol + ":" + side);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, quantity: 1 })
      });
      if (!r.ok) {
        let msg = "";
        try { const j = await r.json(); msg = j?.error || ""; } catch {}
        throw new Error(msg || (await r.text()) || "Erreur inconnue");
      }
      showToast(`${side === "BUY" ? "Acheté" : "Vendu"} 1 ${symbol}`, "success");
    } catch (e) {
      console.error("[watchlist] order fail", e);
      showToast(`Échec de l'ordre rapide${e?.message ? " — " + e.message : ""}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeFav(symbol) {
    try {
      const r = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      if (!r.ok) throw new Error();
      setItems(prev => prev?.filter(it => it.symbol !== symbol) || []);
      showToast(`Retiré ${symbol} des favoris`, "success");
    } catch {
      showToast("Échec suppression favori", "error");
    }
  }

  function refreshQuotes() {
    const next = {};
    for (const it of items || []) next[it.symbol] = undefined;
    setQuotes(next);
  }

  // ----- Réorganiser (fallback ↑ / ↓, persistant) -----
  function moveLocal(idx, dir) {
    // base sur la "vue" actuelle (view), plus intuitif visuellement
    const arr = [...view];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return arr; // no-op
    const [moved] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, moved);
    return arr;
    // ⚠️ on persiste ensuite sur 'items' dans le même ordre
  }

  async function persistOrder(arr) {
    const symbols = arr.map(x => x.symbol);
    // reflet local sur items
    setItems(prev => {
      if (!prev) return prev;
      const map = new Map(prev.map(x => [x.symbol, x]));
      return symbols.map(sym => ({ ...(map.get(sym) || { symbol: sym, name: sym }) }));
    });
    // serveur
    const r = await fetch("/api/watchlist/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols })
    });
    if (!r.ok) throw new Error(await r.text());
  }

  async function onMove(idx, dir) {
    try {
      const newView = moveLocal(idx, dir);
      await persistOrder(newView);
      showToast("Ordre enregistré", "success");
    } catch (e) {
      console.error("[watchlist] reorder fail", e);
      showToast("Échec enregistrement ordre", "error");
      load(); // resync
    }
  }

  return (
    <aside className="sticky top-4">
      <div className="rounded-2xl shadow bg-base-100 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold">Mes favoris</h3>
          <div className="flex items-center gap-2">
            {/* Toggle Réorganiser */}
            <label className="label cursor-pointer gap-2">
              <span className="text-xs opacity-70">Réorganiser</span>
              <input
                type="checkbox"
                className="toggle toggle-xs"
                checked={reorderMode}
                onChange={(e)=>setReorderMode(e.target.checked)}
                title="Activer les flèches ↑/↓ pour réordonner"
              />
            </label>

            <select
              className="select select-xs select-bordered"
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              title="Le tri n’affecte pas l’ordre persistant"
            >
              <option value="symbol">Symbole</option>
              <option value="price">Prix</option>
              <option value="changePct">Var %</option>
            </select>
            <button className="btn btn-xs" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
            <button className="btn btn-xs" onClick={refreshQuotes} title="Rafraîchir les cours">↻</button>
          </div>
        </div>

        <input
          className="input input-bordered w-full mb-3"
          placeholder="Rechercher dans la watchlist…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        {items === null && (
          <div className="space-y-2">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-5/6" />
            <div className="skeleton h-8 w-2/3" />
          </div>
        )}

        {Array.isArray(items) && items.length === 0 && (
          <div className="text-sm text-gray-500">
            Pas encore de favoris. Ajoutez-en via l’étoile ★ sur la fiche d’un titre.
          </div>
        )}

        {Array.isArray(items) && items.length > 0 && (
          <ul className="divide-y">
            {view.map((it, idx) => {
              const qv = quotes[it.symbol] || {};
              const price = qv.price;
              const pct = qv.changePct;
              return (
                <li key={it.symbol} className="py-2 flex items-center gap-2">
                  {/* Flèches visibles uniquement en mode réorganiser */}
                  {reorderMode ? (
                    <div className="flex flex-col items-center mr-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Monter"
                        onClick={() => onMove(idx, -1)}
                        disabled={idx === 0}
                      >↑</button>
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Descendre"
                        onClick={() => onMove(idx, +1)}
                        disabled={idx === view.length - 1}
                      >↓</button>
                    </div>
                  ) : (
                    <span className="select-none pr-1 opacity-30">⋮⋮</span>
                  )}

                  <button
                    className="btn btn-xs"
                    title="Ouvrir"
                    onClick={() => onPick && onPick({ symbol: it.symbol, shortname: it.name || it.symbol })}
                  >
                    {it.symbol}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{it.name || "—"}</div>
                    <div className="text-xs opacity-70">
                      {typeof price === "number" ? price.toFixed(2) : "…"}
                    </div>
                  </div>

                  <div className="w-20 text-right">
                    {typeof pct === "number"
                      ? <PerfBadge value={pct} />
                      : <span className="text-xs opacity-50">—</span>}
                  </div>

                  {!reorderMode && (
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-xs btn-success"
                        onClick={() => quickOrder(it.symbol, "BUY")}
                        disabled={busy === it.symbol + ":BUY"}
                        title="Acheter 1"
                      >
                        +1
                      </button>
                      <button
                        className="btn btn-xs btn-error"
                        onClick={() => quickOrder(it.symbol, "SELL")}
                        disabled={busy === it.symbol + ":SELL"}
                        title="Vendre 1"
                      >
                        −1
                      </button>
                      <button
                        className="btn btn-xs"
                        title="Retirer des favoris"
                        onClick={() => removeFav(it.symbol)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div className="toast toast-end">
          <div className={`alert ${toast.kind === "error" ? "alert-error" : "alert-success"}`}>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </aside>
  );
}