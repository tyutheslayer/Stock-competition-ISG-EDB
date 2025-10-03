// pages/trade.js
import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import NavBar from "../components/NavBar";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import TradingViewChart from "../components/TradingViewChart";
import NeonBackground3D from "../components/NeonBackground3D";

/* ---------- Helpers ---------- */
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
    { test: /\.PA$/,  x: "EURONEXT" }, { test: /\.FR$/,  x: "EURONEXT" },
    { test: /\.DE$/,  x: "XETR"     }, { test: /\.MI$/,  x: "MIL"      },
    { test: /\.AS$/,  x: "EURONEXT" }, { test: /\.BR$/,  x: "EURONEXT" },
    { test: /\.L$/,   x: "LSE"      }, { test: /\.SW$/,  x: "SIX"      },
    { test: /\.MC$/,  x: "BME"      }, { test: /\.TO$/,  x: "TSX"      },
    { test: /\.TS$/,  x: "TSX"      },
  ];
  for (const { test, x } of map) if (test.test(s)) return `${x}:${s.replace(test, "")}`;
  if (s.includes(":")) return s;
  return s;
}

/* ---------- Search (au-dessus du chart) ---------- */
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
        <div className="absolute z-20 mt-1 w-full glass max-h-72 overflow-auto">
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

/* ---------- Page Trade ---------- */
export default function Trade() {
  const { data: session } = useSession();

  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Levier (panel Long/Short)
  const [lev, setLev] = useState(10);

  // Prix
  const priceEUR = Number(quote?.priceEUR);
  const priceReady = Number.isFinite(priceEUR);

  // Poll quote sélectionnée
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

  // LONG / SHORT (order-plus)
  async function submitPlus(side) {
    if (!picked) return;
    if (!priceReady) return setToast({ ok:false, text:"❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0) return setToast({ ok:false, text:"❌ Quantité invalide" });
    setLoading(true);
    try {
      const r = await fetch("/api/order-plus", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          symbol: picked.symbol,
          type: "LEVERAGED",
          side,
          leverage: Number(lev),
          quantity: Number(qty)
        })
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) return setToast({ ok:false, text:`❌ ${j?.error || "Erreur Plus"}` });
      setToast({ ok:true, text:`✅ ${side} ${lev}x placé` });
      // notifier les panneaux qui écouteraient "positions-plus:refresh"
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("positions-plus:refresh"));
    } catch { setToast({ ok:false, text:"❌ Erreur réseau" }); }
    finally { setLoading(false); }
  }

  // Estimation liquidation simple (indicative)
  const liqLong  = useMemo(() => (priceReady && lev>0) ? priceEUR * (1 - 1/lev) : null, [priceEUR, priceReady, lev]);
  const liqShort = useMemo(() => (priceReady && lev>0) ? priceEUR * (1 + 1/lev) : null, [priceEUR, priceReady, lev]);

  return (
    <div className="relative min-h-screen">
      <NavBar />
      <NeonBackground3D />

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

          {/* Droite : Spot + Long/Short */}
          <aside className="col-span-12 md:col-span-3 space-y-4">
            {/* Spot */}
            <div className="glass p-4">
              <h4 className="font-semibold">Trading Spot</h4>
              <div className="mt-1 text-sm opacity-70">
                Prix {priceReady ? `${priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "…"}
              </div>

              {/* ⬇️ grille 3 colonnes = aligne tout sur 1 ligne */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input
                  className="input input-bordered w-full col-span-1"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e)=>setQty(e.target.value)}
                />
                <button
                  className="btn btn-success col-span-1"
                  disabled={loading}
                  onClick={()=>submitSpot("BUY")}
                >
                  {loading ? "…" : "Acheter"}
                </button>
                <button
                  className="btn btn-error col-span-1"
                  disabled={loading}
                  onClick={()=>submitSpot("SELL")}
                >
                  {loading ? "…" : "Vendre"}
                </button>
              </div>
            </div>

            {/* Long / Short */}
            <div className="glass p-4">
              <h4 className="font-semibold">Long / Short (levier)</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="form-control">
                  <span className="label-text">Levier</span>
                  <select className="select select-bordered select-sm" value={lev} onChange={e=>setLev(Number(e.target.value))}>
                    {[1,2,5,10,20,50].map(x => <option key={x} value={x}>{x}x</option>)}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text">Quantité</span>
                  <input className="input input-bordered input-sm" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-2 text-sm">
                  <div className="opacity-70">Liq. Long ~</div>
                  <div className="font-semibold">{Number.isFinite(liqLong) ? `${liqLong.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "—"}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-2 text-sm">
                  <div className="opacity-70">Liq. Short ~</div>
                  <div className="font-semibold">{Number.isFinite(liqShort) ? `${liqShort.toLocaleString("fr-FR",{maximumFractionDigits:4})} €` : "—"}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn btn-success" disabled={loading} onClick={()=>submitPlus("LONG")}>
                  {loading?"…":"Ouvrir Long"}
                </button>
                <button className="btn btn-error" disabled={loading} onClick={()=>submitPlus("SHORT")}>
                  {loading?"…":"Ouvrir Short"}
                </button>
              </div>

              <div className="mt-2 text-xs opacity-70">
                Estimation liquidation ≈ prix * (1 ± 1/levier). Valeurs indicatives (hors frais/intérêts).
              </div>
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