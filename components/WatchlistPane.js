// components/WatchlistPane.js
import { useEffect, useMemo, useState } from "react";

/**
 * Pane Watchlist
 * Props:
 *  - onPick(symbolObj) : callback quand on clique un titre
 */
export default function WatchlistPane({ onPick }) {
  const [items, setItems] = useState(null); // null=loading, []=vide, otherwise array
  const [quotes, setQuotes] = useState({}); // { [symbol]: { priceEUR, currency, rateToEUR, name } }
  const [err, setErr] = useState("");

  // charge la watchlist
  async function loadList() {
    setErr("");
    try {
      const r = await fetch("/api/watchlist");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const arr = await r.json();
      setItems(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("[watchlist] load error", e);
      setItems([]);
      setErr("Impossible de charger vos favoris");
    }
  }

  // quotes pour les symboles visibles
  async function loadQuotes(symbols) {
    if (!symbols?.length) return;
    try {
      const pairs = await Promise.all(
        symbols.map(async (s) => {
          try {
            const r = await fetch(`/api/quote/${encodeURIComponent(s)}`);
            if (!r.ok) throw new Error("HTTP " + r.status);
            const q = await r.json();
            return [s, {
              priceEUR: Number(q?.priceEUR ?? NaN),
              currency: q?.currency || null,
              rateToEUR: Number(q?.rateToEUR ?? 1) || 1,
              name: q?.name || q?.shortName || null,
            }];
          } catch {
            return [s, { priceEUR: NaN }];
          }
        })
      );
      setQuotes(Object.fromEntries(pairs));
    } catch (e) {
      console.error("[watchlist] quotes error", e);
    }
  }

  // initial load + refresh périodique + écoute des changements
  useEffect(() => {
    let timer;
    loadList();
    const onChanged = () => loadList();
    window.addEventListener("watchlist:changed", onChanged);

    // rafraîchit les quotes toutes les 20s
    timer = setInterval(() => {
      const syms = (items || []).map(x => x.symbol);
      if (syms.length) loadQuotes(syms);
    }, 20000);

    return () => {
      window.removeEventListener("watchlist:changed", onChanged);
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chaque fois que la liste bouge → (re)charger les quotes immédiatement
  useEffect(() => {
    const syms = (items || []).map(x => x.symbol);
    if (syms.length) loadQuotes(syms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items?.length]);

  const rows = useMemo(() => Array.isArray(items) ? items : [], [items]);

  return (
    <div className="rounded-2xl shadow bg-base-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Watchlist</h3>
      </div>

      {err && <div className="alert alert-warning mb-2">{err}</div>}

      {items === null ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="skeleton h-4 w-36 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">Aucun favori pour le moment.</div>
      ) : (
        <ul className="divide-y">
          {rows.map((it) => {
            const q = quotes[it.symbol] || {};
            const priceOk = Number.isFinite(q.priceEUR) && q.priceEUR > 0;
            return (
              <li key={it.symbol} className="py-2 flex items-center justify-between gap-3">
                <button
                  className="text-left flex-1 hover:underline"
                  onClick={() => onPick?.({ symbol: it.symbol, shortname: it.name || it.symbol })}
                  title={it.name || it.symbol}
                >
                  <div className="font-medium">{it.symbol}</div>
                  <div className="text-xs opacity-70 truncate">
                    {it.name || "—"}
                  </div>
                </button>

                <div className="text-right min-w-[110px]">
                  <div className="font-semibold">
                    {priceOk ? `${q.priceEUR.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} €` : "…"}
                  </div>
                  <div className="text-[11px] opacity-60">
                    {q.currency && q.currency !== "EUR"
                      ? `${q.currency}→EUR≈${Number(q.rateToEUR||1).toFixed(4)}`
                      : "EUR"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}