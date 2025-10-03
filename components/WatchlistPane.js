import { useEffect, useMemo, useState } from "react";
import PerfBadge from "./PerfBadge";

export default function WatchlistPane({ onPick, className = "" }) {
  const [items, setItems] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const [sortKey, setSortKey] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");
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

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    (async () => {
      const missing = items.filter(it => !quotes[it.symbol]);
      for (const it of missing) {
        try {
          const r = await fetch(`/api/quote/${encodeURIComponent(it.symbol)}`);
          const j = r.ok ? await r.json() : null;
          const priceEUR = Number(j?.priceEUR);
          const changePct = Number(j?.changePct);
          setQuotes(prev => ({
            ...prev,
            [it.symbol]: {
              price: Number.isFinite(priceEUR) ? priceEUR : null,
              changePct: Number.isFinite(changePct) ? changePct : null
            }
          }));
        } catch {
          setQuotes(prev => ({ ...prev, [it.symbol]: { price: null, changePct: null } }));
        }
      }
    })();
  }, [items]); 

  const view = useMemo(() => {
    if (!Array.isArray(items)) return [];
    if (reorderMode) {
      return [...items].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    }
    const s = q.trim().toLowerCase();
    const filtered = s
      ? items.filter(it =>
          it.symbol.toLowerCase().includes(s) ||
          (it.name || "").toLowerCase().includes(s)
        )
      : items;
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
  }, [items, quotes, q, sortKey, sortDir, reorderMode]);

  async function quickOrder(symbol, side) {
    setBusy(symbol + ":" + side);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, quantity: 1 })
      });
      if (!r.ok) throw new Error();
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

  async function onMove(idx, dir) {
    if (!reorderMode) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= view.length) return;
    const arr = [...view];
    const [moved] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, moved);
    const symbols = arr.map(x => x.symbol);
    setItems(prev => {
      if (!prev) return prev;
      const map = new Map(prev.map(x => [x.symbol, x]));
      return symbols.map((sym, i) => ({ ...(map.get(sym) || { symbol: sym, name: sym }), rank: i }));
    });
    try {
      await fetch("/api/watchlist/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
      });
      showToast("Ordre enregistré", "success");
    } catch (e) {
      console.error("[watchlist] reorder fail", e);
      showToast("Échec enregistrement ordre", "error");
      load();
    }
  }

  return (
    <aside className="sticky top-4">
      {/* ⬇️ ici : glassmorphism */}
      <div className={`rounded-2xl p-4 shadow border border-white/20 bg-white/10 backdrop-blur-md ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold">Mes favoris</h3>
          {/* … reste inchangé … */}
        </div>

        {/* … reste du code inchangé … */}
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