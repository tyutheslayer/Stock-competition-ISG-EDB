// pages/trade.jsx
import { getSession, useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import NavBar from "../components/NavBar";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import TradingViewChart from "../components/TradingViewChart";
import PerfBadge from "../components/PerfBadge";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import NavBar from "../components/NavBar";

export default function Trade() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0B1220] to-[#101827] text-white font-orbitron">
      <NavBar />

      {/* === BACKGROUND 3D === */}
      <Canvas className="absolute inset-0 -z-10">
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} />
        <Float speed={2} rotationIntensity={1} floatIntensity={2}>
          <mesh>
            <torusKnotGeometry args={[1, 0.3, 128, 32]} />
            <meshStandardMaterial
              color="#579FD0"
              emissive="#00E5FF"
              emissiveIntensity={0.8}
              metalness={0.7}
              roughness={0.2}
              wireframe
            />
          </mesh>
        </Float>
        <OrbitControls enableZoom={false} />
      </Canvas>

      {/* === CONTENT GLASS === */}
      <main className="relative z-10 container mx-auto px-6 py-12">
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl">
          <h1 className="text-3xl font-bold text-[#00E5FF]">Trading</h1>
          <p className="mt-2 text-gray-300">
            Ici tu retrouveras ton interface de trading, avec le nouveau look futuriste ✨
          </p>
          {/* ⚠️ Ici tu réintègres tes composants fonctionnels (formulaire, tableau, etc.) */}
        </div>
      </main>
    </div>
  );
}

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
// Map Yahoo-style symbols to TradingView fully qualified tickers
function toTradingViewSymbol(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;

  // US (already OK)
  if (!s.includes(".") && !s.includes(":")) return s; // e.g., AAPL

  // Known mappings
  const map = [
    { test: /\.PA$/,  x: 'EURONEXT',  strip: '.PA'  }, // Paris
    { test: /\.FR$/,  x: 'EURONEXT',  strip: '.FR'  }, // alt FR suffix
    { test: /\.DE$/,  x: 'XETR',      strip: '.DE'  }, // Germany
    { test: /\.MI$/,  x: 'MIL',       strip: '.MI'  }, // Italy
    { test: /\.AS$/,  x: 'EURONEXT',  strip: '.AS'  }, // Amsterdam
    { test: /\.BR$/,  x: 'EURONEXT',  strip: '.BR'  }, // Brussels
    { test: /\.L$/,   x: 'LSE',       strip: '.L'   }, // London
    { test: /\.SW$/,  x: 'SIX',       strip: '.SW'  }, // Switzerland
    { test: /\.MC$/,  x: 'BME',       strip: '.MC'  }, // Spain
    { test: /\.TS$/,  x: 'TSX',       strip: '.TS'  }, // Toronto (alt)
    { test: /\.TO$/,  x: 'TSX',       strip: '.TO'  }, // Toronto
  ];

  for (const { test, x, strip } of map) {
    if (test.test(s)) {
      const base = s.replace(test, "");
      return `${x}:${base}`;
    }
  }

  // If the symbol is already fully qualified, keep it
  if (s.includes(":")) return s;

  return s;
}

// Try alternates for “picky” exchanges (mostly Euronext Paris)
// Returns a list you can try in order (we’ll pass only the first to the widget here)
function toTradingViewAlternates(raw) {
  const primary = toTradingViewSymbol(raw);
  const out = [primary].filter(Boolean);

  // For .PA there are sometimes variants (rare, but helps edge cases)
  if (String(raw).toUpperCase().endsWith(".PA")) {
    const base = String(raw).toUpperCase().replace(/\.PA$/, "");
    // primary: EURONEXT:BASE
    out.push(`EURONEXT:${base}`); // duplicate-safe
    // Some tickers differ slightly on TV (fallback idea): add class of lines
    // out.push(`PARIS:${base}`);  // Uncomment if your TV widget setup supports this alias
  }

  // De-dupe
  return [...new Set(out.filter(Boolean))];
}

function parseShort(symbol) {
  const s = String(symbol || "");
  const isUS = /\.|:/.test(s) ? false : /^[A-Z.\-]{1,6}$/.test(s);
  if (isUS) return { label: s, tv: s };
  if (s.endsWith(".PA")) return { label: `${s.replace(".PA", "")} • Paris`, tv: s };
  return { label: s, tv: s };
}

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

function buildLevExtSymbol(base, side, lev) {
  const s = String(base || "").toUpperCase();
  const sd = String(side || "").toUpperCase();
  const l = Math.max(1, Number(lev) || 1);
  return `${s}::LEV:${sd}:${l}x`;
}

/* ---------- Positions EDB Plus (PnL temps réel + total) ---------- */
function PositionsPlusPane() {
  const [rows, setRows] = useState([]);
  const [quotes, setQuotes] = useState({});    // { BASE: { priceEUR } }
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [qClose, setQClose] = useState({});
  const [toast, setToast] = useState(null);

  const metaOf = (ext) => parseExtSymbol(ext);
  const idOf   = (p) => (p?.id != null ? String(p.id) : "");

  async function fetchPositions() {
    const r = await fetch(`/api/positions-plus?t=${Date.now()}`);
    if (!r.ok) return [];
    const j = await r.json().catch(() => []);
    return Array.isArray(j) ? j : [];
  }

  async function refresh() {
    setLoading(true);
    try { setRows(await fetchPositions()); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const onKick = () => refresh();
    window.addEventListener("positions-plus:refresh", onKick);
    return () => window.removeEventListener("positions-plus:refresh", onKick);
  }, []);

  useEffect(() => {
    let alive = true, t = null;
    const poll = async () => {
      const bases = [...new Set(rows.map(r => metaOf(r.symbol).base).filter(Boolean))];
      if (!bases.length) return;
      const next = {};
      for (const s of bases) {
        try {
          const rq = await fetch(`/api/quote/${encodeURIComponent(s)}`);
          if (!rq.ok) continue;
          const q = await rq.json();
          next[s] = q;
        } catch {}
      }
      if (alive) setQuotes(next);
    };
    poll();
    t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [rows]);

  useEffect(() => {
    let alive = true, t = null;
    (async () => { await refresh(); })();
    t = setInterval(() => alive && refresh(), 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  function computePnl(p) {
    const m = metaOf(p.symbol);
    const last = Number(quotes[m.base]?.priceEUR ?? quotes[m.base]?.price ?? NaN);
    const avg  = Number(p.avgPrice ?? NaN);
    const qty  = Number(p.quantity ?? 0);
    if (!Number.isFinite(last) || !Number.isFinite(avg) || !Number.isFinite(qty) || qty <= 0) {
      return { pnl: 0, pnlPct: 0, roePct: 0, last: NaN, margin: 0, notional: 0, m };
    }
    const dir = sideFactor(m.side);
    const pnl = (last - avg) * qty * (m.kind === "LEV" ? dir : 1);
    const notional = last * qty;
    const margin = m.kind === "LEV" ? (avg * qty) / (m.lev || 1) : 0;
    const pnlPct = avg > 0 ? ((last - avg) / avg) * 100 * (m.kind === "LEV" ? dir : 1) : 0;
    const roePct = margin > 0 ? (pnl / margin) * 100 : 0;
    return { pnl, pnlPct, roePct, last, margin, notional, m };
  }

  const totals = rows.reduce(
    (acc, p) => {
      const { pnl, margin } = computePnl(p);
      acc.pnl += pnl;
      acc.margin += margin;
      return acc;
    },
    { pnl: 0, margin: 0 }
  );
  const totalRoe = totals.margin > 0 ? (totals.pnl / totals.margin) * 100 : 0;

  async function closeOne(p, qtyOverride) {
    const id = idOf(p);
    if (!id) return setToast({ ok:false, text:"❌ POSITION_ID_REQUIRED" });

    const n = (qtyOverride != null ? qtyOverride : Number(qClose[id] ?? NaN));
    const quantity = (Number.isFinite(n) && n > 0) ? n : undefined;

    setLoadingId(id);
    try {
      const r = await fetch(`/api/close-plus?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ positionId: id, quantity }),
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) return setToast({ ok:false, text:`❌ ${j?.error || "Fermeture échouée"}` });
      setToast({ ok:true, text:`✅ Fermé${(j?.closedQty || quantity) ? ` (${j?.closedQty || quantity})` : ""}` });
      await refresh();
    } catch {
      setToast({ ok:false, text:"❌ Erreur réseau" });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-6 rounded-2xl shadow bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <div className="text-lg font-semibold">Positions EDB Plus</div>
        <div className="flex items-center gap-4">
          <div className="text-sm opacity-70">PnL total</div>
          <div className={`text-xl font-bold ${totals.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
            {totals.pnl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
          </div>
          {totals.margin > 0 && (
            <div className={`badge ${totalRoe >= 0 ? "badge-success" : "badge-error"}`}>
              ROE {totalRoe.toFixed(1)}%
            </div>
          )}
          <button className={`btn btn-sm ${loading ? "btn-disabled" : "btn-outline"}`} onClick={refresh}>
            {loading ? "…" : "Rafraîchir"}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm opacity-70">Aucune position à effet de levier ouverte.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-pin-rows border-separate border-spacing-0 min-w-full">
            <thead className="sticky top-0 bg-base-100">
              <tr>
                <th>Instrument</th><th>Type</th><th>Qté</th>
                <th>Prix moy. (€)</th><th>Dernier (€)</th>
                <th className="text-right">PnL €</th><th>PnL %</th><th>ROE %</th>
                <th className="w-[300px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const id = idOf(p);
                const { pnl, pnlPct, roePct, last, m } = computePnl(p);
                const t = m.kind === "LEV" ? "LEVERAGED" : (m.kind === "OPT" ? "OPTION" : "SPOT");
                const short = parseShort(m.base);
                return (
                  <tr key={id || `${p.symbol}-${p.avgPrice}-${p.quantity}`}>
                    <td>
                      <div className="font-medium">{short.label}</div>
                      <div className="text-xs opacity-60">
                        {t === "LEVERAGED" ? `${m.side} ${m.lev}x` : t}
                      </div>
                    </td>
                    <td>{t}</td>
                    <td>{p.quantity}</td>
                    <td>{Number(p.avgPrice).toLocaleString("fr-FR", { maximumFractionDigits: 4 })}</td>
                    <td>{Number.isFinite(last) ? last.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : "…"}</td>
                    <td className={`text-right ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {pnl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </td>
                    <td><PerfBadge value={pnlPct} compact /></td>
                    <td>{m.kind === "LEV" ? <PerfBadge value={roePct} compact /> : <span className="opacity-50">—</span>}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          className="input input-bordered w-24"
                          type="number" min={1} max={p.quantity}
                          placeholder="Qté"
                          value={id ? (qClose[id] ?? "") : ""}
                          onChange={(e) => id && setQClose((prev) => ({ ...prev, [id]: e.target.value }))}
                          disabled={loadingId === id}
                        />
                        <button className={`btn btn-outline ${loadingId === id ? "btn-disabled" : ""}`} onClick={() => closeOne(p)}>
                          {loadingId === id ? "…" : "Couper"}
                        </button>
                        <button className={`btn btn-error ${loadingId === id ? "btn-disabled" : ""}`} onClick={() => closeOne(p, p.quantity)}>
                          {loadingId === id ? "…" : "Tout fermer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`alert ${toast.ok ? "alert-success" : "alert-error"} rounded-none`}>
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

  // TP/SL réels
  const [armTpsl, setArmTpsl] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");

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

  // Poll serveur pour déclencher TP/SL
  useEffect(() => {
    if (!isPlus) return;
    const t = setInterval(() => {
      fetch("/api/tpsl/poll", { method: "POST" }).catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [isPlus]);

  const priceEUR = Number(quote?.priceEUR);
  const priceReady = Number.isFinite(priceEUR);
  const feeBps = 0;

  // Estimation liquidation (avant ouverture) : entry ≈ prix actuel
  function estLiq(price, lev, side) {
    if (!Number.isFinite(price) || !Number.isFinite(lev) || lev <= 0) return null;
    if (String(side).toUpperCase() === "LONG")  return price * (1 - 1/lev);
    if (String(side).toUpperCase() === "SHORT") return price * (1 + 1/lev);
    return null;
  }

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

  // PLUS (levier) + TP/SL réels
  async function submitPlus(side) {
    if (!picked) return;
    if (!priceReady) return setToast({ ok:false, text:"❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0) return setToast({ ok:false, text:"❌ Quantité invalide" });

    const mode = "LEVERAGED";
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

      // Déterminer l'extSymbol de la position ouverte
      const extFromApi =
        j?.extSymbol ||
        j?.positionSymbol ||
        j?.position?.symbol ||
        null;
      const extSymbol = extFromApi || buildLevExtSymbol(picked.symbol, side, leverage);

      // Armer TP/SL si demandé
      if (armTpsl && (tp || sl)) {
        try {
          const rr = await fetch("/api/tpsl/arm", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({
              baseSymbol: picked.symbol,
              positionSym: extSymbol,
              side,
              lev: Number(leverage),
              quantity: Number(qty) || null, // null => ALL
              tp: tp ? Number(tp) : null,
              sl: sl ? Number(sl) : null
            })
          });
          if (!rr.ok) {
            setToast({ ok:true, text:`✅ ${side} ${leverage}x placé — TP/SL non armé (serveur)` });
          } else {
            setToast({ ok:true, text:`✅ ${side} ${leverage}x placé — TP/SL armé` });
          }
        } catch {
          setToast({ ok:true, text:`✅ ${side} ${leverage}x placé — (TP/SL: serveur indisponible)` });
        }
      } else {
        setToast({ ok:true, text:`✅ ${side} ${leverage}x placé` });
      }

      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("positions-plus:refresh"));
    } catch { setToast({ ok:false, text:"❌ Erreur réseau" }); }
    finally { setLoading(false); }
  }

  const liqLong  = estLiq(priceEUR, leverage, "LONG");
  const liqShort = estLiq(priceEUR, leverage, "SHORT");

  return (
    <div>
      <NavBar />
      <main className="page max-w-[1400px] mx-auto p-4">
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

          {/* Col centre : Chart + Long/Short */}
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
                      {priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
                    </>
                  ) : "Sélectionnez un instrument"}
                </div>
                {isPlus ? <span className="badge badge-success">Plus</span> : <a className="link" href="/plus">Débloquer Plus</a>}
              </div>

              {/* TradingView thémé */}
              
              <div className="w-full">
                <TradingViewChart
                  symbol={toTradingViewSymbol(picked?.symbol) || "AAPL"}
                  height={520}
                  theme="dark"
                  upColor="#16a34a"
                  downColor="#ef4444"
                  gridColor="#374151"
                  textColor="#d1d5db"
                />
              </div>
            </div>

            {/* Sous le graphique : section LONG/SHORT */}
            <div className="mt-4 rounded-2xl bg-base-100 p-4 shadow">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-semibold">Long / Short (levier)</h4>
                <div className="flex items-center gap-2">
                  <label className="form-control">
                    <span className="label-text">Levier</span>
                    <select
                      className="select select-bordered select-sm"
                      value={leverage}
                      onChange={(e)=>setLeverage(Number(e.target.value))}
                      disabled={!isPlus}
                    >
                      {[1,2,5,10,20,50].map(l => <option key={l} value={l}>{l}x</option>)}
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text">Quantité</span>
                    <input
                      className="input input-bordered input-sm w-24"
                      type="number" min="1"
                      value={qty}
                      onChange={(e)=>setQty(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {/* Info : liquidations */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-base-200/50 p-3">
                  <div className="opacity-70">Prix courant</div>
                  <div className="font-semibold">
                    {priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
                  </div>
                </div>
                <div className="rounded-xl bg-base-200/50 p-3">
                  <div className="opacity-70">Liquidation (Long) ~</div>
                  <div className="font-semibold">
                    {Number.isFinite(liqLong) ? `${liqLong.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-base-200/50 p-3">
                  <div className="opacity-70">Liquidation (Short) ~</div>
                  <div className="font-semibold">
                    {Number.isFinite(liqShort) ? `${liqShort.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "—"}
                  </div>
                </div>
              </div>

              {/* TP / SL (réel via API) */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="label cursor-pointer flex items-center gap-2">
                  <input type="checkbox" className="toggle" checked={armTpsl} onChange={e=>setArmTpsl(e.target.checked)} />
                  <span className="label-text">Armer TP/SL (réel)</span>
                </label>
                <label className="form-control">
                  <span className="label-text">TP (€/action)</span>
                  <input className="input input-bordered input-sm" value={tp} onChange={e=>setTp(e.target.value)} placeholder="ex: 275" />
                </label>
                <label className="form-control">
                  <span className="label-text">SL (€/action)</span>
                  <input className="input input-bordered input-sm" value={sl} onChange={e=>setSl(e.target.value)} placeholder="ex: 240" />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button className="btn btn-success" disabled={!isPlus || loading} onClick={()=>submitPlus("LONG")}>
                  {loading?"…":"Ouvrir Long"}
                </button>
                <button className="btn btn-error" disabled={!isPlus || loading} onClick={()=>submitPlus("SHORT")}>
                  {loading?"…":"Ouvrir Short"}
                </button>
              </div>

              {!isPlus && <div className="mt-2 text-xs opacity-70">Active EDB Plus pour utiliser le levier.</div>}
              <div className="mt-2 text-xs opacity-70">
                Estimation liquidation ≈ prix * (1 ± 1/levier) — hors frais/intérêts. Valeurs indicatives.
              </div>
            </div>
          </section>

          {/* Col droite : Ticket SPOT + Positions Plus */}
          <aside className="col-span-12 md:col-span-3">
            <div className="rounded-2xl bg-base-100 p-4 shadow">
              <h4 className="font-semibold">Trading Spot</h4>
              <div className="mt-2 text-sm opacity-70">
                Frais {feeBps} bps · Prix {priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input className="input input-bordered w-28" type="number" min="1" value={qty} onChange={(e)=>setQty(e.target.value)} />
                <button className="btn btn-success" disabled={loading} onClick={()=>submitSpot("BUY")}>{loading?"…":"Acheter"}</button>
                <button className="btn btn-error"   disabled={loading} onClick={()=>submitSpot("SELL")}>{loading?"…":"Vendre"}</button>
              </div>
            </div>

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