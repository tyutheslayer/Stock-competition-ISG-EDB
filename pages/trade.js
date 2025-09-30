// pages/trade.jsx
import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import NavBar from "../components/NavBar";
import { CardSkeleton } from "../components/Skeletons";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";

/* ---------- Plus status (admin ou abonné) ---------- */
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
  return status;
}

/* ---------- Utils indicateurs ---------- */
function SMA(arr, n) {
  if (!arr?.length || n <= 0) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= n) sum -= arr[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}
function EMA(arr, n) {
  if (!arr?.length || n <= 0) return [];
  const k = 2 / (n + 1);
  const out = [];
  let ema = null;
  for (let i = 0; i < arr.length; i++) {
    ema = ema == null ? arr[i] : arr[i] * k + ema * (1 - k);
    out.push(i >= n - 1 ? ema : null);
  }
  return out;
}
function RSI(arr, n = 14) {
  if (!arr?.length || n <= 0) return [];
  const out = new Array(arr.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const ch = arr[i] - arr[i - 1];
    (ch >= 0 ? (gain += ch) : (loss -= ch));
  }
  let rs = loss === 0 ? 100 : gain / loss;
  out[n] = 100 - 100 / (1 + rs);
  for (let i = n + 1; i < arr.length; i++) {
    const ch = arr[i] - arr[i - 1];
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    gain = (gain * (n - 1) + g) / n;
    loss = (loss * (n - 1) + l) / n;
    rs = loss === 0 ? 100 : gain / loss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/* ---------- Sparkline ---------- */
function Sparkline({ symbol, width=200, height=40, intervalMs=15000, points=60, onSeries }) {
  const [data, setData] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    async function tick() {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
        if (!r.ok) return;
        const q = await r.json();
        const price = Number(q?.price ?? q?.priceEUR ?? NaN);
        if (!Number.isFinite(price)) return;
        setData(prev => {
          const arr = [...prev, price];
          while (arr.length > points) arr.shift();
          return arr;
        });
      } catch {}
    }
    setData([]);
    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => timer.current && clearInterval(timer.current);
  }, [symbol, intervalMs, points]);

  useEffect(() => { onSeries?.(data); }, [data, onSeries]);

  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const path = data.map((v,i)=>{
    const x = i*stepX;
    const y = height - ((v - min)/span)*height;
    return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const up = data[data.length-1] >= data[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`sparkline ${symbol}`}>
      <path d={path} fill="none" stroke={up ? "#16a34a" : "#dc2626"} strokeWidth="2" />
    </svg>
  );
}

/* ---------- SearchBox (debounce) ---------- */
function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
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
          setRes(Array.isArray(data) ? data.slice(0, 8) : []);
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
    <div className="w-full max-w-2xl relative">
      <input
        ref={inputRef}
        className="input input-bordered w-full"
        value={q}
        onChange={(e) => { setQ(e.target.value); setSuppressOpen(false); }}
        placeholder="Tape pour chercher (ex: Airbus, AAPL, AIR.PA)"
        onFocus={() => res.length && !suppressOpen && setOpen(true)}
        onBlur={() => setTimeout(()=>setOpen(false), 150)}
      />
      {open && res.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-base-100 rounded-xl shadow border max-h-64 overflow-auto">
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

/* ---------- Panneaux EDB Plus ---------- */

// Graphique Pro (grand + overlays)
function ProChart({ series, width=800, height=280, overlays }) {
  const data = series || [];
  if (!data.length) return <div className="opacity-60 text-sm">En attente de données…</div>;

  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const toPath = (arr) => arr.map((v,i)=>{
    if (v==null) return null;
    const x = i*stepX, y = height - ((v - min)/span)*height;
    return `${i===0||arr[i-1]==null?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).filter(Boolean).join(" ");

  const pricePath = toPath(data);
  const smaPath = overlays.sma ? toPath(SMA(data, overlays.smaPeriod)) : null;
  const emaPath = overlays.ema ? toPath(EMA(data, overlays.emaPeriod)) : null;

  const rsiArr = overlays.rsi ? RSI(data, overlays.rsiPeriod) : null;

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="rounded-xl bg-base-200/40 border">
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopOpacity="0.25" stopColor="#60a5fa"/>
            <stop offset="100%" stopOpacity="0" stopColor="#60a5fa"/>
          </linearGradient>
        </defs>
        {/* grille légère */}
        {[...Array(6)].map((_,i)=>(
          <line key={i} x1="0" x2={width} y1={(i*height)/5} y2={(i*height)/5} stroke="currentColor" opacity="0.08"/>
        ))}
        {/* prix */}
        <path d={pricePath} fill="none" stroke="#60a5fa" strokeWidth="2" />
        {/* overlays */}
        {smaPath && <path d={smaPath} fill="none" stroke="#22c55e" strokeWidth="1.5" />}
        {emaPath && <path d={emaPath} fill="none" stroke="#eab308" strokeWidth="1.5" />}
      </svg>

      {/* RSI sous-graphe */}
      {rsiArr && (
        <svg width="100%" height="90" viewBox={`0 0 ${width} 90`} className="rounded-xl mt-2 bg-base-200/40 border">
          <rect x="0" y="0" width={width} height="90" fill="none" />
          <line x1="0" x2={width} y1="30" y2="30" stroke="#ef4444" opacity="0.4"/>
          <line x1="0" x2={width} y1="60" y2="60" stroke="#22c55e" opacity="0.4"/>
          {(() => {
            const minY = 0, maxY = 100;
            const toY = (v)=> 90 - ((v - minY) / (maxY - minY)) * 90;
            const stepX = width / Math.max(1, rsiArr.length - 1);
            const path = rsiArr.map((v,i)=>{
              if (v==null) return null;
              const x = i*stepX, y = toY(v);
              return `${i===0||rsiArr[i-1]==null?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
            }).filter(Boolean).join(" ");
            return <path d={path} fill="none" stroke="#a78bfa" strokeWidth="1.5" />;
          })()}
        </svg>
      )}
    </div>
  );
}

// Carnet d'ordres simulé
function OrderBook({ price }) {
  const levels = useMemo(() => {
    if (!Number.isFinite(price)) return [];
    const out = [];
    const step = price * 0.002; // 0.2%
    for (let i = 10; i >= 1; i--) {
      out.push({
        side: "bid",
        px: +(price - i*step).toFixed(4),
        vol: Math.round((Math.random()*0.7+0.3)*100)
      });
    }
    for (let i = 1; i <= 10; i++) {
      out.push({
        side: "ask",
        px: +(price + i*step).toFixed(4),
        vol: Math.round((Math.random()*0.7+0.3)*100)
      });
    }
    return out;
  }, [price]);

  if (!Number.isFinite(price)) return null;
  return (
    <div className="rounded-xl border p-3 bg-base-100">
      <div className="text-sm opacity-70 mb-2">Carnet (données simulées)</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-semibold mb-1">Bids</div>
          <div className="space-y-1">
            {levels.filter(l=>l.side==="bid").map((l,i)=>(
              <div key={i} className="flex items-center gap-2">
                <div className="text-success font-mono w-24">{l.px}</div>
                <div className="h-2 bg-success/20 rounded w-full relative">
                  <div className="absolute inset-y-0 left-0 bg-success/60 rounded" style={{width:`${Math.min(l.vol,100)}%`}}/>
                </div>
                <div className="w-10 text-right text-xs">{l.vol}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold mb-1">Asks</div>
          <div className="space-y-1">
            {levels.filter(l=>l.side==="ask").map((l,i)=>(
              <div key={i} className="flex items-center gap-2">
                <div className="text-error font-mono w-24">{l.px}</div>
                <div className="h-2 bg-error/20 rounded w-full relative">
                  <div className="absolute inset-y-0 left-0 bg-error/60 rounded" style={{width:`${Math.min(l.vol,100)}%`}}/>
                </div>
                <div className="w-10 text-right text-xs">{l.vol}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Calculateur Long/Short
function LeverageCalc({ price }) {
  const [side, setSide] = useState("LONG");
  const [lev, setLev] = useState(3);
  const [move, setMove] = useState(2); // %
  const notional = 1000; // base
  const pnl = useMemo(()=>{
    if (!Number.isFinite(price)) return null;
    const dir = side==="LONG" ? 1 : -1;
    return (notional * lev) * (dir * (move/100));
  }, [price, side, lev, move]);
  return (
    <div className="rounded-xl border p-3 bg-base-100">
      <div className="text-sm opacity-70 mb-2">Calculateur PnL (démo)</div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="join">
          <button className={`btn btn-sm join-item ${side==="LONG"?"btn-primary":""}`} onClick={()=>setSide("LONG")}>Long</button>
          <button className={`btn btn-sm join-item ${side==="SHORT"?"btn-primary":""}`} onClick={()=>setSide("SHORT")}>Short</button>
        </div>
        <label className="form-control w-32">
          <span className="label-text">Levier</span>
          <input className="input input-bordered" type="number" min={1} max={20} value={lev} onChange={e=>setLev(Number(e.target.value)||1)}/>
        </label>
        <label className="form-control w-40">
          <span className="label-text">Mouvement (%)</span>
          <input className="input input-bordered" type="number" step="0.5" value={move} onChange={e=>setMove(Number(e.target.value)||0)}/>
        </label>
        <div className="ml-auto text-right">
          <div className="opacity-70 text-sm">Base: €{notional}</div>
          <div className={`text-lg font-semibold ${pnl>=0?"text-success":"text-error"}`}>
            PnL estimé: {pnl!=null ? pnl.toLocaleString("fr-FR",{maximumFractionDigits:0})+" €" : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Pricer Black-Scholes
function normCdf(x){ // approximation rapide
  return 0.5*(1+Math.erf ? Math.erf(x/Math.SQRT2) : (()=> {
    // poly approx
    const t=1/(1+0.2316419*Math.abs(x));
    const d=0.3989423*Math.exp(-x*x/2)*((((1.330274429*t-1.821255978)*t+1.781477937)*t-0.356563782)*t+0.319381530);
    return x>=0?1-d:d;
  })());
}
function bs(S,K,T,σ,r,call=true){
  const d1=(Math.log(S/K)+(r+0.5*σ*σ)*T)/(σ*Math.sqrt(T));
  const d2=d1-σ*Math.sqrt(T);
  const Nd1 = normCdf((call?1:-1)*d1);
  const Nd2 = normCdf((call?1:-1)*d2);
  const price = call ? S*normCdf(d1)-K*Math.exp(-r*T)*normCdf(d2)
                     : K*Math.exp(-r*T)*normCdf(-d2)-S*normCdf(-d1);
  return { price, d1, d2,
    delta: call ? normCdf(d1) : normCdf(d1)-1,
    gamma: Math.exp(-0.5*d1*d1)/(S*σ*Math.sqrt(2*Math.PI*T)),
    theta: 0, // (on omet pour concision)
    vega: S*Math.sqrt(T)*Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI),
    rho: call ? K*T*Math.exp(-r*T)*normCdf(d2) : -K*T*Math.exp(-r*T)*normCdf(-d2)
  };
}
function OptionPricer({ spot }) {
  const [call, setCall] = useState(true);
  const [K, setK] = useState(()=> spot ? Math.round(spot) : 100);
  const [days, setDays] = useState(30);
  const [vol, setVol] = useState(0.25);
  const [rate, setRate] = useState(0.02);
  const T = Math.max(days,1)/365;
  const S = Number(spot||NaN);
  const out = Number.isFinite(S) ? bs(S,K,T,vol,rate,call) : null;

  return (
    <div className="rounded-xl border p-3 bg-base-100">
      <div className="text-sm opacity-70 mb-2">Prix théorique (Black-Scholes)</div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="join">
          <button className={`btn btn-sm join-item ${call?"btn-primary":""}`} onClick={()=>setCall(true)}>Call</button>
          <button className={`btn btn-sm join-item ${!call?"btn-primary":""}`} onClick={()=>setCall(false)}>Put</button>
        </div>
        <label className="form-control w-28">
          <span className="label-text">Strike</span>
          <input className="input input-bordered" type="number" value={K} onChange={e=>setK(Number(e.target.value)||0)}/>
        </label>
        <label className="form-control w-28">
          <span className="label-text">Échéance (j)</span>
          <input className="input input-bordered" type="number" value={days} onChange={e=>setDays(Number(e.target.value)||1)}/>
        </label>
        <label className="form-control w-28">
          <span className="label-text">Vol (σ)</span>
          <input className="input input-bordered" type="number" step="0.01" value={vol} onChange={e=>setVol(Number(e.target.value)||0)}/>
        </label>
        <label className="form-control w-28">
          <span className="label-text">Taux (r)</span>
          <input className="input input-bordered" type="number" step="0.005" value={rate} onChange={e=>setRate(Number(e.target.value)||0)}/>
        </label>
        <div className="ml-auto">
          <div className="text-sm opacity-70">Spot: {Number.isFinite(S)?S.toLocaleString("fr-FR",{maximumFractionDigits:2})+" €":"—"}</div>
          <div className="text-lg font-semibold">
            Prix: {out ? out.price.toLocaleString("fr-FR",{maximumFractionDigits:2})+" €" : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trade page ---------- */
export default function Trade() {
  const { data: session } = useSession();
  const plusStatus = usePlusStatus();
  const isPlus = String(plusStatus).toLowerCase() === "active";

  const [picked, setPicked] = useState(null);
  const [series, setSeries] = useState([]);               // ← pour Graphique Pro
  const [overlays, setOverlays] = useState({ sma:false, ema:false, rsi:false, smaPeriod:20, emaPeriod:20, rsiPeriod:14 });
  const [activePanel, setActivePanel] = useState(null);   // "chart" | "indics" | "book" | "ls" | "opts"

  const [quote, setQuote] = useState(null);
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const [feeBps, setFeeBps] = useState(0);

  // Charger frais
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const j = await r.json();
        if (alive) setFeeBps(Number(j?.tradingFeeBps || 0));
      } catch { if (alive) setFeeBps(0); }
    })();
    return () => { alive = false; };
  }, []);

  const feeRate = Math.max(0, Number(feeBps) || 0) / 10000;
  const priceReady = useMemo(() => Number.isFinite(Number(quote?.priceEUR ?? quote?.price)), [quote]);
  const estPriceEUR = Number(quote?.priceEUR ?? quote?.price ?? NaN);
  const estQty       = Number(qty || 0);
  const estNotional  = Number.isFinite(estPriceEUR) && estQty > 0 ? estPriceEUR * estQty : 0;
  const estFee       = estNotional * feeRate;
  const estBuyTotal  = estNotional + estFee;
  const estSellNet   = Math.max(estNotional - estFee, 0);

  /* ---- favoris ---- */
  useEffect(()=> {
    (async ()=>{
      if(!picked) return setFav(false);
      const r = await fetch("/api/watchlist");
      if(!r.ok) return;
      const arr = await r.json();
      setFav(arr.some(x=>x.symbol===picked.symbol));
    })();
  }, [picked]);

  async function toggleFav(){
    if(!picked) return;
    try {
      if (fav) {
        const r = await fetch("/api/watchlist",{ method:"DELETE", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({symbol:picked.symbol}) });
        if (!r.ok) throw new Error();
        setFav(false);
        setToast({ text: `Retiré ${picked.symbol} des favoris`, ok: true });
      } else {
        const r = await fetch("/api/watchlist",{ method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({symbol:picked.symbol, name:picked.shortname}) });
        if (!r.ok) throw new Error();
        setFav(true);
        setToast({ text: `Ajouté ${picked.symbol} aux favoris`, ok: true });
      }
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("watchlist:changed"));
    } catch {
      setToast({ text: "❌ Échec mise à jour favoris", ok: false });
    }
  }

  /* ---- quote ---- */
  useEffect(() => {
    if (!picked) return;
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

  /* ---- envoi ordre ---- */
  async function submit(side) {
    if (!picked) return;
    if (!priceReady) { setToast({ text: "❌ Prix indisponible", ok: false }); return; }
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) { setToast({ text: "❌ Quantité invalide", ok: false }); return; }

    setLoading(true);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: picked.symbol, side, quantity: Number(qty) })
      });
      if (r.ok) {
        let info = null; try { info = await r.json(); } catch {}
        if (side === "BUY" && Number.isFinite(info?.debitedEUR)) {
          setToast({ text: `✅ Ordre exécuté — Débit: ${info.debitedEUR.toLocaleString("fr-FR",{maximumFractionDigits:2})} € (frais ${info.feeBps} bps)`, ok: true });
        } else if (side === "SELL" && Number.isFinite(info?.creditedEUR)) {
          setToast({ text: `✅ Ordre exécuté — Crédit net: ${info.creditedEUR.toLocaleString("fr-FR",{maximumFractionDigits:2})} € (frais ${info.feeBps} bps)`, ok: true });
        } else {
          setToast({ text: "✅ Ordre exécuté", ok: true });
        }
      } else {
        let e = { error: "Erreur" }; try { e = await r.json(); } catch {}
        setToast({ text: `❌ ${e.error || "Erreur ordre"}`, ok: false });
      }
    } catch {
      setToast({ text: "❌ Erreur réseau", ok: false });
    } finally { setLoading(false); }
  }

  /* ---- UI ---- */
  return (
    <div>
      <NavBar />
      <main className="page p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <aside className="md:col-span-4 order-2 md:order-1">
            {session ? <WatchlistPane onPick={setPicked} /> : (
              <div className="rounded-2xl shadow bg-base-100 p-4 text-sm text-gray-500">
                Connectez-vous pour voir vos favoris.
              </div>
            )}
          </aside>

          <section className="md:col-span-8 order-1 md:order-2">
            <h1 className="text-3xl font-bold text-primary text-center">Trading</h1>
            {!session && (
              <div className="alert alert-warning mt-4 w-full max-w-2xl mx-auto">
                Vous devez être connecté.
              </div>
            )}

            <div className="mt-5 w-full flex flex-col items-center">
              <SearchBox onPick={setPicked} />

              {/* Barre d’outils EDB Plus */}
              {isPlus && (
                <div className="mt-4 w-full max-w-2xl rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-4 border">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">Outils EDB Plus</div>
                    <div className="divider divider-horizontal" />
                    <div className="join">
                      <button className={`btn btn-sm join-item ${activePanel==="chart"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="chart"?null:"chart")}>Graphique Pro</button>
                      <button className={`btn btn-sm join-item ${activePanel==="indics"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="indics"?null:"indics")}>Indicators</button>
                      <button className={`btn btn-sm join-item ${activePanel==="book"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="book"?null:"book")}>Carnet (β)</button>
                    </div>
                    <div className="divider divider-horizontal" />
                    <div className="join">
                      <button className={`btn btn-sm join-item ${activePanel==="ls"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="ls"?null:"ls")}>Long</button>
                      <button className={`btn btn-sm join-item ${activePanel==="ls"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="ls"?null:"ls")}>Short</button>
                    </div>
                    <div className="divider divider-horizontal" />
                    <div className="join">
                      <button className={`btn btn-sm join-item ${activePanel==="opts"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="opts"?null:"opts")}>Call</button>
                      <button className={`btn btn-sm join-item ${activePanel==="opts"?"btn-primary":""}`} onClick={()=>setActivePanel(activePanel==="opts"?null:"opts")}>Put</button>
                    </div>
                    <span className="badge badge-outline ml-auto">β</span>
                  </div>
                  <div className="mt-3 text-xs opacity-70">
                    Les actions “Long/Short/Options” sont des calculateurs côté client (pas d’exécution pour l’instant).
                  </div>
                </div>
              )}

              {/* Panneaux EDB Plus */}
              {isPlus && activePanel && (
                <div className="mt-4 w-full max-w-2xl space-y-3">
                  {activePanel==="indics" && (
                    <div className="rounded-xl border p-3 bg-base-100">
                      <div className="font-medium mb-2">Indicators</div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="label cursor-pointer gap-2">
                          <input type="checkbox" className="toggle" checked={overlays.sma} onChange={e=>setOverlays(o=>({...o,sma:e.target.checked}))}/>
                          <span className="label-text">SMA</span>
                        </label>
                        <input type="number" className="input input-bordered w-24" value={overlays.smaPeriod} min={2} onChange={e=>setOverlays(o=>({...o,smaPeriod:Number(e.target.value)||2}))}/>
                        <label className="label cursor-pointer gap-2">
                          <input type="checkbox" className="toggle" checked={overlays.ema} onChange={e=>setOverlays(o=>({...o,ema:e.target.checked}))}/>
                          <span className="label-text">EMA</span>
                        </label>
                        <input type="number" className="input input-bordered w-24" value={overlays.emaPeriod} min={2} onChange={e=>setOverlays(o=>({...o,emaPeriod:Number(e.target.value)||2}))}/>
                        <label className="label cursor-pointer gap-2">
                          <input type="checkbox" className="toggle" checked={overlays.rsi} onChange={e=>setOverlays(o=>({...o,rsi:e.target.checked}))}/>
                          <span className="label-text">RSI</span>
                        </label>
                        <input type="number" className="input input-bordered w-24" value={overlays.rsiPeriod} min={2} onChange={e=>setOverlays(o=>({...o,rsiPeriod:Number(e.target.value)||2}))}/>
                      </div>
                    </div>
                  )}
                  {activePanel==="chart" && (
                    <div className="rounded-xl border p-3 bg-base-100">
                      <ProChart series={series} overlays={overlays} />
                    </div>
                  )}
                  {activePanel==="book" && <OrderBook price={estPriceEUR} />}
                  {activePanel==="ls" && <LeverageCalc price={estPriceEUR} />}
                  {activePanel==="opts" && <OptionPricer spot={estPriceEUR} />}
                </div>
              )}

              {picked && (
                <>
                  {!priceReady ? (
                    <div className="mt-6 w-full max-w-2xl"><CardSkeleton /></div>
                  ) : (
                    <div className="mt-6 w-full max-w-2xl p-5 rounded-2xl shadow bg-base-100 text-left">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-xl font-semibold flex items-center gap-3">
                            {picked.symbol} — {quote?.name || picked.shortname}
                            <button className="btn btn-xs" onClick={toggleFav}>{fav ? "★" : "☆"}</button>
                          </h3>

                          <div className="stats shadow">
                            <div className="stat">
                              <div className="stat-title">Prix (EUR)</div>
                              <div className="stat-value text-primary">
                                {priceReady ? `${estPriceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
                              </div>
                              <div className="stat-desc">
                                {quote?.currency && quote?.currency !== "EUR"
                                  ? `Devise: ${quote.currency} — taux EUR≈ ${Number(quote.rateToEUR || 1).toFixed(4)}`
                                  : "Devise: EUR"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Sparkline symbol={picked.symbol} onSeries={setSeries} />
                        </div>

                        <div className="flex items-center gap-2">
                          <input className="input input-bordered w-32" type="number" min="1"
                            value={qty} onChange={(e)=>setQty(e.target.value)} />
                          <button className="btn btn-success" onClick={()=>submit("BUY")}
                            disabled={!priceReady || !Number.isFinite(Number(qty)) || Number(qty)<=0 || loading}>
                            {loading ? "…" : "Acheter"}
                          </button>
                          <button className="btn btn-error" onClick={()=>submit("SELL")}
                            disabled={!priceReady || !Number.isFinite(Number(qty)) || Number(qty)<=0 || loading}>
                            {loading ? "…" : "Vendre"}
                          </button>
                        </div>

                        {/* Estimation frais */}
                        <div className="mt-3 text-sm bg-base-200/50 rounded-xl p-3">
                          <div className="font-medium mb-1">Estimation (frais inclus)</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div><div className="opacity-70">Frais</div><div>{feeBps} bps ({(feeRate*100).toFixed(3)}%)</div></div>
                            <div><div className="opacity-70">Achat (débit)</div><div>{estBuyTotal>0 ? `${estBuyTotal.toLocaleString("fr-FR",{maximumFractionDigits:2})} €` : "—"}</div></div>
                            <div><div className="opacity-70">Vente (crédit net)</div><div>{estSellNet>0 ? `${estSellNet.toLocaleString("fr-FR",{maximumFractionDigits:2})} €` : "—"}</div></div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
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