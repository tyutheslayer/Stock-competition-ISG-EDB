import { useEffect, useMemo, useState } from "react";

/**
 * Panneau latéral Watchlist (favoris)
 * - Recherche locale
 * - Quick Buy / Quick Sell (qty=1) avec toast
 * - Suppression d'un favori
 * - Rafraîchit automatiquement quand l'étoile est cliquée (event 'watchlist:changed')
 */
export default function WatchlistPane({ onPick }) {
  const [items, setItems] = useState(null); // null = loading, [] = vide
  const [prices, setPrices] = useState({}); // { AAPL: 182.3, ... }
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null); // symbol en action (quick buy/sell)

  // Toast local minimal
  const [toast, setToast] = useState(null); // { msg, kind: 'success'|'error' }

  function showToast(msg, kind = "success") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
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

  // fetch au montage
  useEffect(() => { load(); }, []);

  // se recharger quand l’étoile déclenche un changement
  useEffect(() => {
    function onChanged() { load(); }
    if (typeof window !== "undefined") {
      window.addEventListener("watchlist:changed", onChanged);
      return () => window.removeEventListener("watchlist:changed", onChanged);
    }
  }, []);

  // récupérer les prix manquants quand la liste change
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    (async () => {
      const missing = items.filter(it => typeof prices[it.symbol] !== "number");
      for (const it of missing) {
        try {
          const r = await fetch(`/api/quote/${encodeURIComponent(it.symbol)}`);
          const j = r.ok ? await r.json() : null;
          const p = Number(j?.price);
          setPrices(prev => ({ ...prev, [it.symbol]: (Number.isFinite(p) && p > 0) ? p : null }));
        } catch {
          setPrices(prev => ({ ...prev, [it.symbol]: null }));
        }
      }
    })();
  }, [items]);

  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(it =>
      it.symbol.toLowerCase().includes(s) ||
      (it.name || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  async function quickOrder(symbol, side) {
    setBusy(symbol + ":" + side);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, qty: 1 })
      });
      if (!r.ok) throw new Error(await r.text());
      showToast(`${side === "BUY" ? "Acheté" : "Vendu"} 1 ${symbol}`, "success");
    } catch (e) {
      console.error("[watchlist] order fail", e);
      showToast("Échec de l'ordre rapide", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeFav(symbol) {
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      setItems(prev => prev?.filter(it => it.symbol !== symbol) || []);
      showToast(`Retiré ${symbol} des favoris`, "success");
    } catch {
      showToast("Échec suppression favori", "error");
    }
  }

  return (
    <aside className="sticky top-4">
      <div className="rounded-2xl shadow bg-base-100 p-4">
        <h3 className="text-lg font-semibold mb-2">Mes favoris</h3>

        {/* Barre de recherche locale */}
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
            {filtered.map(it => {
              const p = prices[it.symbol];
              return (
                <li key={it.symbol} className="py-2 flex items-center gap-2">
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
                      {typeof p === "number" ? p.toFixed(2) : "…"}
                    </div>
                  </div>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Toast minimal (en bas à droite de la page) */}
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