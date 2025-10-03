// pages/trade.js
import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import NavBar from "../components/NavBar";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import TradingViewChart from "../components/TradingViewChart";
import PerfBadge from "../components/PerfBadge";

/* === 3D décorative — ultra légère === */
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";

/* ---- Helpers locaux ---- */
function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

function toTradingViewSymbol(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;
  if (!s.includes(".") && !s.includes(":")) return s;
  const map = [
    { test: /\.PA$/,  x: "EURONEXT", strip: ".PA" },
    { test: /\.FR$/,  x: "EURONEXT", strip: ".FR" },
    { test: /\.DE$/,  x: "XETR",     strip: ".DE" },
    { test: /\.MI$/,  x: "MIL",      strip: ".MI" },
    { test: /\.AS$/,  x: "EURONEXT", strip: ".AS" },
    { test: /\.BR$/,  x: "EURONEXT", strip: ".BR" },
    { test: /\.L$/,   x: "LSE",      strip: ".L" },
    { test: /\.SW$/,  x: "SIX",      strip: ".SW" },
    { test: /\.MC$/,  x: "BME",      strip: ".MC" },
    { test: /\.TO$/,  x: "TSX",      strip: ".TO" },
    { test: /\.TS$/,  x: "TSX",      strip: ".TS" },
  ];
  for (const { test, x } of map) if (test.test(s)) return `${x}:${s.replace(test, "")}`;
  if (s.includes(":")) return s;
  return s;
}

/* ---- Search simple (au dessus du chart) ---- */
function SearchBox({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const debounced = useDebounced(q, 250);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!debounced || debounced.length < 2) { setRes([]); setOpen(false); return; }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
        const data = await r.json();
        if (!alive) return;
        setRes(Array.isArray(data) ? data.slice(0, 8) : []);
        if (!suppressOpen && inputRef.current === document.activeElement) setOpen(true);
      } catch {}
    })();
    return () => { alive = false; };
  }, [debounced, suppressOpen]);

  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        className="input input-bordered w-full"
        placeholder="Rechercher une valeur (ex: AAPL, TSLA, AIR.PA)…"
        value={q}
        onChange={(e)=>{ setQ(e.target.value); setSuppressOpen(false); }}
        onFocus={() => res.length && !suppressOpen && setOpen(true)}
        onBlur={() => setTimeout(()=>setOpen(false), 150)}
      />
      {open && res.length > 0 && (
        <div className="absolute z-20 mt-1 w-full glass">
          {res.map(item => (
            <button
              key={item.symbol}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-white/10 rounded"
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

/* ---- Fond 3D décoratif très peu coûteux ---- */
function Background3D() {
  const [dpr, setDpr] = useState([1, 1.25]); // on commence bas

  return (
    <Canvas
      className="pointer-events-none absolute inset-0 -z-10"
      frameloop="demand"                 // 👈 pas d’animation continue
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 6], fov: 45 }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr([1, 1.5])}
        onDecline={() => setDpr([1, 1.1])}
      />
      <ambientLight intensity={0.35} />
      {/* un seul mesh low-poly, wireframe, pas d’updates */}
      <mesh position={[0, 2.5, -2]}>
        <torusKnotGeometry args={[1, 0.25, 80, 10]} />
        <meshStandardMaterial
          color="#579FD0"
          emissive="#00E5FF"
          emissiveIntensity={0.6}
          metalness={0.7}
          roughness={0.2}
          wireframe
        />
      </mesh>
    </Canvas>
  );
}

/* ============================= */
/* Page Trade                    */
/* ============================= */

export default function Trade() {
  const { data: session } = useSession();
  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const priceEUR = Number(quote?.priceEUR);
  const priceReady = Number.isFinite(priceEUR);
  const feeBps = 0;

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
      setToast({ ok:true, text:"✅ Ordre exécuté" });
    } catch { setToast({ ok:false, text:"❌ Erreur réseau" }); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative min-h-screen">
      <NavBar />
      <Background3D />

      <main className="page">
        <div className="grid grid-cols-12 gap-5">

          {/* Watchlist */}
          <aside className="col-span-12 md:col-span-3">
            <div className="glass p-4">
              <h3 className="text-lg font-semibold mb-2">Mes favoris</h3>
              {session ? (
                <WatchlistPane onPick={setPicked} />
              ) : (
                <div className="text-sm opacity-70">Connecte-toi pour voir tes favoris.</div>
              )}
            </div>
          </aside>

          {/* Centre : search + chart */}
          <section className="col-span-12 md:col-span-6">
            <div className="glass p-4">
              <div className="mb-3"><SearchBox onPick={setPicked} /></div>

              <div className="flex items-center justify-between mb-2 text-sm opacity-80">
                {picked?.symbol ? (
                  <>
                    <span>
                      <b>{picked.symbol}</b> · {quote?.name || picked?.shortname || "—"}
                    </span>
                    <span>{priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}</span>
                  </>
                ) : <span>Sélectionnez un instrument</span>}
              </div>

              <TradingViewChart
                symbol={toTradingViewSymbol(picked?.symbol) || "AAPL"}
                height={520}
                theme="dark"
                upColor="#16a34a"
                downColor="#ef4444"
                gridColor="#2a3850"
                textColor="#cfe7ff"
              />
            </div>
          </section>

          {/* Droite : ticket spot + (tes autres panneaux si besoin) */}
          <aside className="col-span-12 md:col-span-3">
            <div className="glass p-4">
              <h4 className="font-semibold">Trading Spot</h4>
              <div className="mt-1 text-sm opacity-70">
                Frais {feeBps} bps · Prix {priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input className="input input-bordered w-28" type="number" min="1" value={qty} onChange={(e)=>setQty(e.target.value)} />
                <button className="btn btn-success" disabled={loading} onClick={()=>submitSpot("BUY")}>{loading?"…":"Acheter"}</button>
                <button className="btn btn-error"   disabled={loading} onClick={()=>submitSpot("SELL")}>{loading?"…":"Vendre"}</button>
              </div>
            </div>

            {/* exemple de panneau “Positions” en glass */}
            <div className="glass p-4 mt-4">
              <h4 className="font-semibold">Positions</h4>
              <div className="text-sm opacity-70 mt-1">Aucune position à effet de levier ouverte.</div>
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