// pages/trade.js
import { getSession, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "../components/PageShell";
import Toast from "../components/Toast";
import WatchlistPane from "../components/WatchlistPane";
import TradingViewChart from "../components/TradingViewChart";

/* ---------- Helpers ---------- */
function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// ✅ Détection mobile pour adapter la hauteur du chart
function useIsMobile(breakpointPx = 768) {
  const [isMob, setIsMob] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpointPx - 1}px)`);
    const apply = () => setIsMob(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [breakpointPx]);
  return isMob;
}

function toTradingViewSymbol(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;
  if (!s.includes(".") && !s.includes(":")) return s;
  const map = [
    { test: /\.PA$/, x: "EURONEXT" },
    { test: /\.FR$/, x: "EURONEXT" },
    { test: /\.DE$/, x: "XETR" },
    { test: /\.MI$/, x: "MIL" },
    { test: /\.AS$/, x: "EURONEXT" },
    { test: /\.BR$/, x: "EURONEXT" },
    { test: /\.L$/, x: "LSE" },
    { test: /\.SW$/, x: "SIX" },
    { test: /\.MC$/, x: "BME" },
    { test: /\.TO$/, x: "TSX" },
    { test: /\.TS$/, x: "TSX" },
  ];
  for (const { test, x } of map) if (test.test(s)) return `${x}:${s.replace(test, "")}`;
  if (s.includes(":")) return s;
  return s;
}

/* Frais: calcule le montant en EUR (arrondi au centime) */
function computeFeeEUR({ price, qty, bps }) {
  const notional = Math.max(0, Number(price) * Number(qty));
  const fee = notional * (Number(bps) / 10000);
  return Math.round(fee * 100) / 100;
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
      if (!debounced || debounced.length < 2) {
        setRes([]);
        setOpen(false);
        return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
        const data = await r.json();
        if (!alive) return;
        setRes(Array.isArray(data) ? data.slice(0, 8) : []);
        if (!suppressOpen && inputRef.current === document.activeElement) setOpen(true);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [debounced, suppressOpen]);

  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        className="input input-bordered w-full"
        placeholder="Rechercher une valeur (ex: AAPL, TSLA, AIR.PA)…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSuppressOpen(false);
        }}
        onFocus={() => res.length && !suppressOpen && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && res.length > 0 && (
        <div className="absolute z-20 mt-1 w-full glass max-h-72 overflow-auto">
          {res.map((item) => (
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

/* ---------- Panneau lite : positions à levier ---------- */
function PositionsPlusPaneLite() {
  const [rows, setRows] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/positions-plus?t=${Date.now()}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => []);
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    refresh();
    const onKick = () => refresh();
    if (typeof window !== "undefined") {
      window.addEventListener("positions-plus:refresh", onKick);
    }
    const t = setInterval(refresh, 20000);
    return () => {
      window.removeEventListener("positions-plus:refresh", onKick);
      clearInterval(t);
    };
  }, []);

  async function closeOne(id, qty) {
    if (!id) return;
    setLoadingId(id);
    try {
      await fetch(`/api/close-plus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: String(id), quantity: qty }),
      });
      await refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (!rows.length) {
    return (
      <div className="glass p-4">
        <h4 className="font-semibold mb-1">Positions Plus</h4>
        <div className="text-sm opacity-70">Aucune position à effet de levier ouverte.</div>
      </div>
    );
  }

  return (
    <div className="glass p-4">
      <h4 className="font-semibold">Positions Plus</h4>
      <ul className="mt-2 space-y-2">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <div className="truncate">
              <b>{p.base || p.symbol}</b>
              <span className="badge badge-ghost ml-2">
                {p.side} {p.leverage}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-80">
                {Number(p.pnlPct || 0).toFixed(2)}%
              </span>
              <button
                className="btn btn-xs btn-outline"
                onClick={() => closeOne(p.id)}
                disabled={loadingId === p.id}
              >
                Fermer
              </button>
              <button
                className="btn btn-xs btn-error"
                onClick={() => closeOne(p.id, p.quantity)}
                disabled={loadingId === p.id}
              >
                Tout fermer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Petit composant d'info frais ---------- */
function TradingFeeBanner({ bps, className = "" }) {
  if (bps === null || bps === undefined) {
    return (
      <div className={`alert alert-info ${className}`}>
        <span>Chargement des frais…</span>
      </div>
    );
  }
  const pct = (Number(bps) / 100).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });
  return (
    <div className={`rounded-xl bg-base-200/60 border border-base-300 px-4 py-3 text-sm ${className}`}>
      <div className="font-medium">Frais de trading</div>
      <div className="opacity-80">
        {pct}% par ordre (soit {bps} bps). Les frais sont intégrés au calcul du
        P&amp;L.
      </div>
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

  // Frais (bps) — chargés via /api/settings
  const [feeBps, setFeeBps] = useState(null);

  // ✅ Statut EDB Plus (API)
  const [isPlusActiveApi, setIsPlusActiveApi] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) {
          setIsPlusActiveApi(String(j?.status).toLowerCase() === "active");
        }
      } catch {
        if (alive) setIsPlusActiveApi(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ Statut EDB Plus combiné (session + API)
  const isPlus = useMemo(() => {
    const u = session?.user || {};
    const fromSession =
      u.isPlus === true ||
      u.isPlusActive === true ||
      u.plusStatus === "active" ||
      u.role === "PLUS" ||
      u.role === "ADMIN";
    return Boolean(fromSession || isPlusActiveApi);
  }, [session, isPlusActiveApi]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const j = await r.json();
        if (alive) setFeeBps(Number(j?.tradingFeeBps ?? 0));
      } catch {
        if (alive) setFeeBps(0);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Prix
  const priceEUR = Number(quote?.priceEUR);
  const priceReady = Number.isFinite(priceEUR);

  // Estimation des frais sur l’ordre SPOT en cours
  const feePreview = useMemo(() => {
    if (
      !priceReady ||
      !Number.isFinite(Number(qty)) ||
      !Number.isFinite(Number(feeBps))
    )
      return null;
    return computeFeeEUR({ price: priceEUR, qty: Number(qty), bps: feeBps });
  }, [priceEUR, priceReady, qty, feeBps]);

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
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [picked]);

  // SPOT
  async function submitSpot(side) {
    if (!picked) return;
    if (!priceReady) return setToast({ ok: false, text: "❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0)
      return setToast({ ok: false, text: "❌ Quantité invalide" });
    setLoading(true);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: picked.symbol,
          side,
          quantity: Number(qty),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok)
        return setToast({
          ok: false,
          text: `❌ ${j?.error || "Erreur ordre"}`,
        });
      setToast({ ok: true, text: "✅ Ordre SPOT exécuté" });
    } catch {
      setToast({ ok: false, text: "❌ Erreur réseau" });
    } finally {
      setLoading(false);
    }
  }

  // LONG / SHORT (order-plus) — ⚠️ verrouillé si non-Plus
  async function submitPlus(side) {
    if (!isPlus) {
      return setToast({
        ok: false,
        text: "🔒 Fonction réservée aux membres EDB Plus",
      });
    }
    if (!picked) return;
    if (!priceReady) return setToast({ ok: false, text: "❌ Prix indisponible" });
    if (!Number.isFinite(Number(qty)) || qty <= 0)
      return setToast({ ok: false, text: "❌ Quantité invalide" });
    setLoading(true);
    try {
      const r = await fetch("/api/order-plus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: picked.symbol,
          type: "LEVERAGED",
          side,
          leverage: Number(lev),
          quantity: Number(qty),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok)
        return setToast({
          ok: false,
          text: `❌ ${j?.error || "Erreur Plus"}`,
        });
      setToast({ ok: true, text: `✅ ${side} ${lev}x placé` });
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("positions-plus:refresh"));
    } catch {
      setToast({ ok: false, text: "❌ Erreur réseau" });
    } finally {
      setLoading(false);
    }
  }

  const liqLong = useMemo(
    () => (priceReady && lev > 0 ? priceEUR * (1 - 1 / lev) : null),
    [priceEUR, priceReady, lev]
  );
  const liqShort = useMemo(
    () => (priceReady && lev > 0 ? priceEUR * (1 + 1 / lev) : null),
    [priceEUR, priceReady, lev]
  );

  const isMobile = useIsMobile(768); // ⬅️ utilisé pour la hauteur du chart

  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        {/* Watchlist */}
        <aside className="col-span-12 md:col-span-3">
          <div className="glass p-4">
            <h3 className="text-lg font-semibold mb-2">Mes favoris</h3>
            {session ? (
              <WatchlistPane onPick={setPicked} />
            ) : (
              <div className="text-sm opacity-70">
                Connecte-toi pour voir tes favoris.
              </div>
            )}
          </div>
        </aside>

        {/* Centre : search + chart */}
        <section className="col-span-12 md:col-span-6">
          <div className="glass p-4">
            <div className="mb-3">
              <SearchBox onPick={setPicked} />
            </div>

            <div className="flex items-center justify-between mb-2 text-sm opacity-80">
              {picked?.symbol ? (
                <>
                  <span>
                    <b>{picked.symbol}</b> ·{" "}
                    {quote?.name || picked?.shortname || "—"}
                  </span>
                  <span>
                    {priceReady
                      ? `${priceEUR.toLocaleString("fr-FR", {
                          maximumFractionDigits: 4,
                        })} €`
                      : "…`"}
                  </span>
                </>
              ) : (
                <span>Sélectionnez un instrument</span>
              )}
            </div>

            <TradingViewChart
              symbol={toTradingViewSymbol(picked?.symbol) || "AAPL"}
              height={isMobile ? 360 : 520}
              theme="dark"
              upColor="#16a34a"
              downColor="#ef4444"
              gridColor="#2a3850"
              textColor="#cfe7ff"
            />
          </div>
        </section>

        {/* Droite : Spot + Long/Short + Positions Plus */}
        <aside className="col-span-12 md:col-span-3 space-y-4">
          {/* Banner frais */}
          <TradingFeeBanner
            bps={feeBps}
            className="glass p-3 !bg-transparent"
          />

          {/* Spot */}
          <div className="glass p-4">
            <h4 className="font-semibold">Trading Spot</h4>
            <div className="mt-1 text-sm opacity-70">
              Prix{" "}
              {priceReady
                ? `${priceEUR.toLocaleString("fr-FR", {
                    maximumFractionDigits: 4,
                  })} €`
                : "…"}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <input
                className="input input-bordered w-full col-span-1"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <button
                className="btn btn-success col-span-1"
                disabled={loading}
                onClick={() => submitSpot("BUY")}
              >
                {loading ? "…" : "Acheter"}
              </button>
              <button
                className="btn btn-error col-span-1"
                disabled={loading}
                onClick={() => submitSpot("SELL")}
              >
                {loading ? "…" : "Vendre"}
              </button>
            </div>

            {/* Estimation des frais */}
            <div className="mt-2 text-xs opacity-80">
              {Number.isFinite(feeBps) && feePreview !== null ? (
                <>
                  Frais estimés :{" "}
                  <b>
                    {feePreview.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </b>{" "}
                  (
                  {(feeBps / 100).toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                  %)
                </>
              ) : (
                "Frais : —"
              )}
            </div>
          </div>

          {/* Long / Short */}
          {isPlus ? (
            <div className="glass p-4">
              <h4 className="font-semibold">Long / Short (levier)</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="form-control">
                  <span className="label-text">Levier</span>
                  <select
                    className="select select-bordered select-sm"
                    value={lev}
                    onChange={(e) => setLev(Number(e.target.value))}
                  >
                    {[1, 2, 5, 10, 20, 50].map((x) => (
                      <option key={x} value={x}>
                        {x}x
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text">Quantité</span>
                  <input
                    className="input input-bordered input-sm"
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-2 text-sm">
                  <div className="opacity-70">Liq. Long ~</div>
                  <div className="font-semibold">
                    {Number.isFinite(liqLong)
                      ? `${liqLong.toLocaleString("fr-FR", {
                          maximumFractionDigits: 4,
                        })} €`
                      : "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 p-2 text-sm">
                  <div className="opacity-70">Liq. Short ~</div>
                  <div className="font-semibold">
                    {Number.isFinite(liqShort)
                      ? `${liqShort.toLocaleString("fr-FR", {
                          maximumFractionDigits: 4,
                        })} €`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="btn btn-success"
                  disabled={loading}
                  onClick={() => submitPlus("LONG")}
                >
                  {loading ? "…" : "Ouvrir Long"}
                </button>
                <button
                  className="btn btn-error"
                  disabled={loading}
                  onClick={() => submitPlus("SHORT")}
                >
                  {loading ? "…" : "Ouvrir Short"}
                </button>
              </div>

              <div className="mt-2 text-xs opacity-70">
                Estimation liquidation ≈ prix * (1 ± 1/levier). Valeurs indicatives
                (hors frais/intérêts).
              </div>
            </div>
          ) : (
            <div className="glass p-4">
              <h4 className="font-semibold">Long / Short (levier)</h4>
              <div className="mt-2 text-sm opacity-80">
                🔒 Fonction réservée aux membres <b>EDB Plus</b>.
              </div>
              <a href="/plus" className="btn btn-primary btn-sm mt-3">
                Découvrir EDB Plus
              </a>
            </div>
          )}

          {/* 👇 panneau lite des positions à levier (réservé Plus) */}
          {isPlus && <PositionsPlusPaneLite />}
        </aside>
      </div>

      {toast && (
        <Toast text={toast.text} ok={toast.ok} onDone={() => setToast(null)} />
      )}
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}