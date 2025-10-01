// pages/trade.jsx
import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import NavBar from "../components/NavBar";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import TradingViewChart from "../components/TradingViewChart";

/* ============================= */
/* Utils & hooks                 */
/* ============================= */

function usePlusStatus() {
  const [status, setStatus] = useState("none");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setStatus(j?.status || "none");
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return status; // "active" | "pending" | "canceled" | "none"
}

function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ============================= */
/* Search (au dessus du chart)   */
/* ============================= */

function SearchBox({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const debounced = useDebounced(q, 250);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!debounced || debounced.length < 2) {
        setRes([]); setOpen(false); return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
        const data = await r.json();
        if (alive) {
          setRes(Array.isArray(data) ? data.slice(0, 10) : []);
          if (!suppressOpen && inputRef.current === (typeof document !== "undefined" ? document.activeElement : null)) {
            setOpen(true);
          }
        }
      } catch {}
    }
    run();
    return () => { alive = false; };
  }, [debounced, suppressOpen]);

  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        className="input input-bordered w-full"
        value={q}
        onChange={(e) => { setQ(e.target.value); setSuppressOpen(false); }}
        placeholder="Rechercher une valeur (ex: AAPL, TSLA, AIR.PA)…"
        onFocus={() => res.length && !suppressOpen && setOpen(true)}
        onBlur={() => setTimeout(()=>setOpen(false), 150)}
      />
      {open && res.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-base-100 rounded-xl shadow border max-h-72 overflow-auto">
          {res.map(item => (
            <button
              key={item.symbol}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-base-200 rounded"
              onClick={() => {
                onPick(item);
                setQ(item.symbol);
                setOpen(false);
                setRes([]);
                setSuppressOpen(true);
                inputRef.current?.blur();
              }}
            >
              <b>{item.symbol}</b> — {item.shortname}
              <span className="badge mx-2">{item.exchange}</span>
              <span className="badge">{item.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================= */
/* Helpers                       */
/* ============================= */

function parseExtSymbol(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts.length < 2) return { base, kind: "SPOT" };
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase(); // LONG|SHORT
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  if (parts[1] === "OPT") {
    const side = (parts[2] || "").toUpperCase(); // CALL|PUT
    return { base, kind: "OPT", side, lev: 1 };
  }
  return { base, kind: "SPOT" };
}
const sideFactor = (side) => (String(side).toUpperCase() === "SHORT" ? -1 : 1);

/* ============================= */
/* Positions Plus (droite)       */
/* ============================= */

function PositionsPlusPane() {
  const [rows, setRows] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [qClose, setQClose] = useState({});
  const [toast, setToast] = useState(null);

  async function fetchPositions() {
    const r = await fetch(`/api/positions-plus?t=${Date.now()}`);
    if (!r.ok) return [];
    const j = await r.json().catch(()=>[]);
    return Array.isArray(j) ? j : [];
  }
  async function refresh() {
    setLoading(true);
    try { setRows(await fetchPositions()); } catch { setRows([]); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ refresh(); }, []);
  useEffect(() => {
    function kick(){ refresh(); }
    window.addEventListener("positions-plus:refresh", kick);
    return () => window.removeEventListener("positions-plus:refresh", kick);
  }, []);

  // quotes polling (base symbols)
  useEffect(() => {
    let alive = true, t = null;
    async function poll() {
      const bases = Array.from(new Set(rows.map(r => parseExtSymbol(r.symbol).base)));
      if (!bases.length) return;
      const next = {};
      for (const s of bases) {
        try {
          const r = await fetch(`/api/quote/${encodeURIComponent(s)}`);
          if (!r.ok) continue;
          next[s] = await r.json();
        } catch {}
      }
      if (alive) setQuotes(next);
    }
    poll();
    t = setInterval(poll, 12000);
    return () => { alive = false; t && clearInterval(t); };
  }, [rows]);

  async function closeOne(p, qtyOverride) {
    const id = p?.id;
    if (id == null) {
      return setToast({ ok: false, text: "❌ POSITION_ID_REQUIRED" });
    }

    // On calcule proprement la quantité :
    // - si `qtyOverride` est passé => on l’utilise
    // - sinon on lit l’input stocké dans qClose[id]
    // - si vide / invalide / 0 => undefined (=> close total côté API)
    const rawQty = qtyOverride ?? Number(qClose[id] ?? NaN);
    const quantity = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : undefined;

    setLoadingId(id);
    try {
      const r = await fetch(`/api/close-plus?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: id,
          quantity, // ✅ plus de mélange ?? et ||
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return setToast({ ok: false, text: `❌ ${j?.error || "Fermeture échouée"}` });
      }
      setToast({
        ok: true,
        text: `✅ Position fermée${(j?.closedQty || quantity) ? ` (${j?.closedQty || quantity})` : ""}`,
      });
      await refresh();
    } catch {
      setToast({ ok: false, text: "❌ Erreur réseau" });
    } finally {
      setLoadingId(null);
    }
  }

  function pnlPretty(p) {
    const meta = parseExtSymbol(p.symbol);
    const last = Number(quotes[meta.base]?.priceEUR ?? quotes[meta.base]?.price ?? NaN);
    const avg  = Number(p.avgPrice ?? p.avgPriceEUR ?? NaN);
    const qty  = Number(p.quantity || 0);
    if (!Number.isFinite(last) || !Number.isFinite(avg) || !qty) return { abs:null, pct:null, label:"—" };

    if (meta.kind === "LEV") {
      const pnlAbs = (last - avg) * qty * sideFactor(meta.side);
      const margin = (avg * qty) / (meta.lev || 1);
      const pnlPct = margin > 0 ? (pnlAbs / margin) * 100 : 0;
      const sign = pnlAbs >= 0 ? "+" : "−";
      return {
        abs: pnlAbs,
        pct: pnlPct,
        label: `${sign === "−" ? "" : "+"}${pnlAbs.toLocaleString("fr-FR",{maximumFractionDigits:2})} €  ·  ${pnlPct>=0?"+":""}${pnlPct.toFixed(2)}% sur marge`
      };
    }
    if (meta.kind === "OPT") {
      // Intrinsèque simple ; plus lisible que des centimes
      const intrinsic = (meta.side === "CALL")
        ? Math.max(0, last - avg) * qty
        : Math.max(0, avg - last) * qty;
      return {
        abs: intrinsic,
        pct: null,
        label: `${intrinsic>=0?"+":""}${intrinsic.toLocaleString("fr-FR",{maximumFractionDigits:2})} € (intrinsèque)`
      };
    }
    return { abs:null, pct:null, label:"—" };
  }

  return (
    <div className="rounded-2xl bg-base-100 p-4 shadow">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Positions EDB Plus</h4>
        <button className={`btn btn-sm ${loading?"btn-disabled":"btn-outline"}`} onClick={refresh}>
          {loading ? "…" : "Rafraîchir"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm opacity-70">Aucune position Plus ouverte.</div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((p) => {
            const meta = parseExtSymbol(p.symbol);
            const id = p.id;
            const last = Number(quotes[meta.base]?.priceEUR ?? quotes[meta.base]?.price ?? NaN);
            const pnl = pnlPretty(p);
            const chip =
              meta.kind === "LEV" ? `${meta.side} ${meta.lev}x`
              : meta.kind === "OPT" ? `${meta.side}`
              : "SPOT";

            return (
              <div key={id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{meta.base} <span className="badge badge-ghost ml-2">{chip}</span></div>
                    <div className="text-xs opacity-70">Qté {p.quantity} · Prix moy. {Number(p.avgPrice).toLocaleString("fr-FR",{maximumFractionDigits:4})} € · Dernier {Number.isFinite(last)? last.toLocaleString("fr-FR",{maximumFractionDigits:4}):"…" } €</div>
                  </div>
                  <div className={`font-semibold ${pnl.abs>=0 ? "text-green-500" : "text-red-500"}`}>{pnl.label}</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="input input-bordered w-28"
                    type="number"
                    min={1}
                    max={p.quantity}
                    placeholder="Qté"
                    value={qClose[id] ?? ""}
                    onChange={(e)=> setQClose(prev=>({...prev, [id]: e.target.value}))}
                    disabled={loadingId === id}
                  />
                  <button className={`btn btn-outline btn-sm ${loadingId===id?"btn-disabled":""}`} onClick={()=>closeOne(p)}>
                    {loadingId===id?"…":"Couper"}
                  </button>
                  <button className={`btn btn-error btn-sm ${loadingId===id?"btn-disabled":""}`} onClick={()=>closeOne(p, p.quantity)}>
                    {loadingId===id?"…":"Tout fermer"}
                  </button>
                </div>
              </div>
            );
          })}
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

/* ============================= */
/* Page Trade (layout 3 colonnes)*/
/* ============================= */

export default function Trade() {
  const { data: session } = useSession();
  const plusStatus = usePlusStatus();
  const isPlus = String(plusStatus).toLowerCase() === "active";

  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [leverage, setLeverage] = useState(10);

  // quote pour l’en-tête
  useEffect(() => {
    if (!picked?.symbol) return;
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(picked.symbol)}`);
        const data = await r.json();
        if (alive) setQuote(data);
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [picked]);

  const priceReady = Number.isFinite(Number(quote?.priceEUR));
  const feeBps = 0; // affichage simplifié ici

  // SPOT
  async function submitSpot(side) {
    if (!picked) return;
    if (!priceReady) return setToast({ ok:false, text:"❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0) return setToast({ ok:false, text:"❌ Quantité invalide" });
    setLoading(true);
    try {
      const r = await fetch("/api/order", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ symbol: picked.symbol, side, quantity: Number(qty) })
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) return setToast({ ok:false, text:`❌ ${j?.error || "Erreur ordre"}` });
      setToast({ ok:true, text:"✅ Ordre SPOT exécuté" });
    } catch { setToast({ ok:false, text:"❌ Erreur réseau" }); }
    finally { setLoading(false); }
  }

  // PLUS (levier/options)
  async function submitPlus(side) {
    if (!picked) return;
    if (!priceReady) return setToast({ ok:false, text:"❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0) return setToast({ ok:false, text:"❌ Quantité invalide" });

    const mode = (side === "LONG" || side === "SHORT") ? "LEVERAGED" : "OPTION";
    setLoading(true);
    try {
      const r = await fetch("/api/order-plus", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          symbol: picked.symbol,
          type: mode,
          side,
          leverage: Number(leverage),
          quantity: Number(qty),
        })
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) return setToast({ ok:false, text:`❌ ${j?.error || "Erreur ordre Plus"}` });
      setToast({ ok:true, text:`✅ ${side} ${mode==="LEVERAGED"?`${leverage}x `:""}placé` });
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("positions-plus:refresh"));
    } catch { setToast({ ok:false, text:"❌ Erreur réseau" }); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-[1400px] mx-auto p-4">
        {/* grille 3 colonnes */}
        <div className="grid grid-cols-12 gap-4">
          {/* Col gauche : Watchlist */}
          <aside className="col-span-12 md:col-span-3">
            {session ? (
              <div className="rounded-2xl bg-base-100 p-3 shadow">
                <h3 className="font-semibold mb-2">Watchlist</h3>
                <WatchlistPane onPick={setPicked} />
              </div>
            ) : (
              <div className="rounded-2xl bg-base-100 p-4 shadow text-sm text-gray-500">
                Connectez-vous pour voir vos favoris.
              </div>
            )}
          </aside>

          {/* Col centre : Chart + tickets dérivés */}
          <section className="col-span-12 md:col-span-6">
            <div className="rounded-2xl bg-base-100 p-4 shadow">
              <div className="mb-3">
                <SearchBox onPick={setPicked} />
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="text-sm opacity-70">
                  {picked?.symbol ? (
                    <>
                      <b>{picked.symbol}</b> · {quote?.name || picked?.shortname || "—"} ·{" "}
                      {priceReady ? `${quote.priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
                    </>
                  ) : "Sélectionnez un instrument"}
                </div>
                {isPlus ? <span className="badge badge-success">Plus</span> : <a className="link" href="/plus">Débloquer Plus</a>}
              </div>

              <div className="w-full">
                <TradingViewChart symbol={picked?.symbol || "AAPL"} height={520} />
              </div>
            </div>

            {/* Sous le graphique : sections LONG/SHORT et CALL/PUT */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Levier */}
              <div className="rounded-2xl bg-base-100 p-4 shadow">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Long / Short (levier)</h4>
                  <select
                    className="select select-bordered select-sm"
                    value={leverage}
                    onChange={(e)=>setLeverage(Number(e.target.value))}
                    disabled={!isPlus}
                  >
                    {[1,2,5,10,20,50].map(l => <option key={l} value={l}>{l}x</option>)}
                  </select>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input className="input input-bordered w-28" type="number" min="1" value={qty} onChange={(e)=>setQty(e.target.value)} />
                  <button className="btn btn-success" disabled={!isPlus || loading} onClick={()=>submitPlus("LONG")}>{loading?"…":"Long"}</button>
                  <button className="btn btn-error" disabled={!isPlus || loading} onClick={()=>submitPlus("SHORT")}>{loading?"…":"Short"}</button>
                </div>
                {!isPlus && <div className="mt-2 text-xs opacity-70">Active EDB Plus pour utiliser le levier.</div>}
              </div>

              {/* Options */}
              <div className="rounded-2xl bg-base-100 p-4 shadow">
                <h4 className="font-semibold">Options (démo)</h4>
                <div className="mt-3 flex items-center gap-2">
                  <input className="input input-bordered w-28" type="number" min="1" value={qty} onChange={(e)=>setQty(e.target.value)} />
                  <button className="btn btn-primary"  disabled={!isPlus || loading} onClick={()=>submitPlus("CALL")}>{loading?"…":"Call"}</button>
                  <button className="btn btn-secondary" disabled={!isPlus || loading} onClick={()=>submitPlus("PUT")}>{loading?"…":"Put"}</button>
                </div>
                {!isPlus && <div className="mt-2 text-xs opacity-70">Active EDB Plus pour trader des Calls / Puts (simulés).</div>}
              </div>
            </div>
          </section>

          {/* Col droite : Ticket SPOT + Positions Plus */}
          <aside className="col-span-12 md:col-span-3">
            {/* Ticket Spot */}
            <div className="rounded-2xl bg-base-100 p-4 shadow">
              <h4 className="font-semibold">Trading Spot</h4>
              <div className="mt-2 text-sm opacity-70">
                Frais {feeBps} bps · Prix {priceReady ? `${quote.priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input className="input input-bordered w-28" type="number" min="1" value={qty} onChange={(e)=>setQty(e.target.value)} />
                <button className="btn btn-success" disabled={loading} onClick={()=>submitSpot("BUY")}>{loading?"…":"Acheter"}</button>
                <button className="btn btn-error"   disabled={loading} onClick={()=>submitSpot("SELL")}>{loading?"…":"Vendre"}</button>
              </div>
            </div>

            {/* Positions Plus */}
            <div className="mt-4">
              <PositionsPlusPane />
            </div>
          </aside>
        </div>
      </main>
      {toast && <Toast text={toast.text} ok={toast.ok} onDone={()=>setToast(null)} />}
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}