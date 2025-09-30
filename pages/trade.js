import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import NavBar from "../components/NavBar";
import { CardSkeleton } from "../components/Skeletons";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <PlusThemeProvider>
      <Component {...pageProps} />
    </PlusThemeProvider>
  );
}
/* ---------- Sparkline ---------- */
function Sparkline({ symbol, width=200, height=40, intervalMs=15000, points=30 }) {
  const [data, setData] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    async function tick() {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
        if (!r.ok) return;
        const q = await r.json();
        const price = Number(q?.price ?? NaN);
        if (!Number.isFinite(price)) return;
        setData(prev => {
          const arr = [...prev, price];
          if (arr.length > points) arr.shift();
          return arr;
        });
      } catch {}
    }
    setData([]);
    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => timer.current && clearInterval(timer.current);
  }, [symbol, intervalMs, points]);

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

/* ---------- SearchBox ---------- */
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
        setRes([]);
        setOpen(false);
        return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
        const data = await r.json();
        if (alive) {
          setRes(Array.isArray(data) ? data.slice(0, 8) : []);
          if (!suppressOpen && inputRef.current === document.activeElement) {
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

/* ---------- Trade page ---------- */
export default function Trade() {
  const { data: session } = useSession();
  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const [feeBps, setFeeBps] = useState(0);

  // charger frais
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

  const priceReady = useMemo(() => Number.isFinite(Number(quote?.priceEUR)), [quote]);
  const estPriceEUR = Number(quote?.priceEUR || NaN);
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
        const r = await fetch("/api/watchlist",{
          method:"DELETE",
          headers:{ "Content-Type":"application/json"},
          body: JSON.stringify({symbol:picked.symbol})
        });
        if (!r.ok) throw new Error();
        setFav(false);
        setToast({ text: `Retiré ${picked.symbol} des favoris`, ok: true });
      } else {
        const r = await fetch("/api/watchlist",{
          method:"POST",
          headers:{ "Content-Type":"application/json"},
          body: JSON.stringify({symbol:picked.symbol, name:picked.shortname})
        });
        if (!r.ok) throw new Error();
        setFav(true);
        setToast({ text: `Ajouté ${picked.symbol} aux favoris`, ok: true });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("watchlist:changed"));
      }
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

  /* ---- submit ---- */
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
        let info = null;
        try { info = await r.json(); } catch {}
        if (side === "BUY" && Number.isFinite(info?.debitedEUR)) {
          setToast({
            text: `✅ Ordre exécuté — Débit: ${info.debitedEUR.toLocaleString("fr-FR",{maximumFractionDigits:2})} € (frais ${info.feeBps} bps)`,
            ok: true
          });
        } else if (side === "SELL" && Number.isFinite(info?.creditedEUR)) {
          setToast({
            text: `✅ Ordre exécuté — Crédit net: ${info.creditedEUR.toLocaleString("fr-FR",{maximumFractionDigits:2})} € (frais ${info.feeBps} bps)`,
            ok: true
          });
        } else {
          setToast({ text: "✅ Ordre exécuté", ok: true });
        }
      } else {
        let e = { error: "Erreur" };
        try { e = await r.json(); } catch {}
        setToast({ text: `❌ ${e.error || "Erreur ordre"}`, ok: false });
      }
    } catch {
      setToast({ text: "❌ Erreur réseau", ok: false });
    } finally {
      setLoading(false);
    }
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
                            <button className="btn btn-xs" onClick={toggleFav}>
                              {fav ? "★" : "☆"}
                            </button>
                          </h3>

                          <div className="stats shadow">
                            <div className="stat">
                              <div className="stat-title">Prix (EUR)</div>
                              <div className="stat-value text-primary">
                                {priceReady ? `${quote.priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
                              </div>
                              <div className="stat-desc">
                                {quote?.currency && quote?.currency !== "EUR"
                                  ? `Devise: ${quote.currency} — taux EUR≈ ${Number(quote.rateToEUR || 1).toFixed(4)}`
                                  : "Devise: EUR"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2"><Sparkline symbol={picked.symbol} /></div>

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

                        {/* Bloc estimation frais */}
                        <div className="mt-3 text-sm bg-base-200/50 rounded-xl p-3">
                          <div className="font-medium mb-1">Estimation (frais inclus)</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <div className="opacity-70">Frais</div>
                              <div>{feeBps} bps ({(feeRate*100).toFixed(3)}%)</div>
                            </div>
                            <div>
                              <div className="opacity-70">Achat (débit)</div>
                              <div>{estBuyTotal>0 ? `${estBuyTotal.toLocaleString("fr-FR",{maximumFractionDigits:2})} €` : "—"}</div>
                            </div>
                            <div>
                              <div className="opacity-70">Vente (crédit net)</div>
                              <div>{estSellNet>0 ? `${estSellNet.toLocaleString("fr-FR",{maximumFractionDigits:2})} €` : "—"}</div>
                            </div>
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