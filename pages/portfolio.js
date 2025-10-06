// pages/portfolio.js
import { useEffect, useMemo, useState } from "react";
import PerfBadge from "../components/PerfBadge";
import PageShell from "../components/PageShell";
import GlassPanel from "../components/GlassPanel";

/* ===== Helpers dates/CSV ===== */
function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function toIsoStartOfDay(localDateStr) { return new Date(localDateStr + "T00:00:00.000Z").toISOString(); }
function toIsoEndOfDay(localDateStr)   { return new Date(localDateStr + "T23:59:59.999Z").toISOString(); }

function jsonOrdersToCsv(rows) {
  const header = ["date","symbol","side","quantity","price_native","currency","rate_to_eur","price_eur","fee_eur","total_eur"];
  const lines = [header.join(",")];
  for (const r of rows || []) {
    const qty = Number(r.quantity || 0);
    const pxNative = Number(r.price || 0);
    const rate = Number(r.rateToEUR || 1);
    const pxEUR = Number.isFinite(Number(r.priceEUR)) ? Number(r.priceEUR) : pxNative * (Number.isFinite(rate) && rate > 0 ? rate : 1);
    const fee = Number(r.feeEUR || 0);
    const total = Number.isFinite(Number(r.totalEUR)) ? Number(r.totalEUR) : (String(r.side).toUpperCase()==="BUY" ? qty*pxEUR+fee : qty*pxEUR-fee);
    lines.push([new Date(r.createdAt).toISOString(), r.symbol, r.side, qty, pxNative, r.currency||"EUR", rate, pxEUR, fee, total].join(","));
  }
  return lines.join("\n");
}
async function downloadUrlAsCsv(url, filename="orders.csv") {
  const r = await fetch(url, { headers: { "Accept":"text/csv,*/*;q=0.8" } });
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  let blob;
  if (r.ok && ct.includes("text/csv")) blob = await r.blob();
  else {
    const data = await r.json().catch(()=>[]);
    const csv = jsonOrdersToCsv(Array.isArray(data) ? data : []);
    blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  }
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/* ====== Parse symbole étendu (Plus) ====== */
function parseExtSymbol(ext) {
  const parts = String(ext || "").split("::");
  const base = parts[0] || ext;
  if (parts.length < 2) return { base, kind: "SPOT" };
  if (parts[1] === "LEV") {
    const side = (parts[2] || "").toUpperCase();
    const lev = Math.max(1, Math.min(50, Number(String(parts[3] || "1x").replace(/x$/i, "")) || 1));
    return { base, kind: "LEV", side, lev };
  }
  if (parts[1] === "OPT") {
    const side = (parts[2] || "").toUpperCase();
    return { base, kind: "OPT", side, lev: 1 };
  }
  return { base, kind: "SPOT" };
}
const sideFactor = (s) => (String(s).toUpperCase()==="SHORT" ? -1 : 1);

/* ====== Cartes mobiles (Spot) ====== */
function SpotMobileCard({ p }) {
  const q  = Number(p.quantity || 0);
  const avg = Number(p.avgPriceEUR || 0);
  const last = Number(p.lastEUR || 0);
  const pct = (avg>0 && Number.isFinite(last)) ? ((last-avg)/avg)*100 : 0;

  return (
    <div className="rounded-2xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{p.symbol}</div>
          <div className="text-sm opacity-80 truncate">{p.name || "—"}</div>
        </div>
        <span className="badge badge-ghost shrink-0">{p.currency || "EUR"}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="opacity-70">Qté</div>
          <div className="font-medium">{q}</div>
        </div>
        <div>
          <div className="opacity-70">Dernier</div>
          <div className="font-medium">{Number.isFinite(last)&&last>0?`${last.toFixed(2)} €`:"—"}</div>
        </div>
        <div>
          <div className="opacity-70">Prix moyen</div>
          <div className="font-medium">{avg?`${avg.toFixed(2)} €`:"—"}</div>
        </div>
        <div>
          <div className="opacity-70">P&L</div>
          <div className="font-medium"><PerfBadge value={pct} compact /></div>
        </div>
      </div>
    </div>
  );
}

/* ====== Bloc Historique (responsive) ====== */
function OrdersHistory() {
  const today = useMemo(() => new Date(), []);
  const d30 = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000), []);
  const [from, setFrom] = useState(fmtDateInput(d30));
  const [to, setTo] = useState(fmtDateInput(today));
  const [side, setSide] = useState("ALL");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(""); setRows(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", toIsoStartOfDay(from));
        if (to)   params.set("to", toIsoEndOfDay(to));
        if (side !== "ALL") params.set("side", side);
        params.set("limit", "500");
        const r = await fetch(`/api/orders?${params.toString()}`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) { setErr("Impossible de charger l’historique d’ordres"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, [from, to, side]);

  const safeRows = Array.isArray(rows) ? rows : [];
  const hasRows = safeRows.length > 0;

  return (
    <section className="mt-10 w-full">
      <GlassPanel className="mb-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <h2 className="text-2xl font-semibold">Historique d’ordres</h2>
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <label className="form-control">
              <span className="label-text">Depuis</span>
              <input type="date" className="input input-bordered" value={from} max={to} onChange={(e)=>setFrom(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text">Jusqu’au</span>
              <input type="date" className="input input-bordered" value={to} min={from} onChange={(e)=>setTo(e.target.value)} />
            </label>
            <label className="form-control col-span-2 sm:col-span-1">
              <span className="label-text">Sens</span>
              <select className="select select-bordered" value={side} onChange={(e)=>setSide(e.target.value)}>
                <option value="ALL">Tous</option>
                <option value="BUY">Achats</option>
                <option value="SELL">Ventes</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-outline col-span-2 sm:col-span-1"
              onClick={() => {
                const url = `/api/orders?from=${encodeURIComponent(toIsoStartOfDay(from))}&to=${encodeURIComponent(toIsoEndOfDay(to))}${side!=="ALL"?`&side=${side}`:""}&format=csv`;
                downloadUrlAsCsv(url, `orders_${from}_to_${to}.csv`);
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      </GlassPanel>

      {err && <div className="alert alert-warning mb-3">{err}</div>}

      {rows === null ? (
        <GlassPanel>Chargement…</GlassPanel>
      ) : !hasRows ? (
        <div className="opacity-70">Aucun ordre sur la période.</div>
      ) : (
        <GlassPanel className="overflow-x-auto">
          {/* Tableau desktop */}
          <div className="hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Symbole</th><th>Sens</th><th>Qté</th><th>Prix (EUR)</th><th>Frais (EUR)</th><th>Total net (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {safeRows.map((o) => {
                  const qty = Number(o.quantity||0);
                  const priceEUR = Number.isFinite(Number(o.priceEUR)) ? Number(o.priceEUR)
                                    : Number(o.price||0) * (Number(o.rateToEUR||1) || 1);
                  const fee = Number(o.feeEUR || 0);
                  const total = Number.isFinite(Number(o.totalEUR)) ? Number(o.totalEUR)
                                : (o.side==="BUY" ? qty*priceEUR + fee : qty*priceEUR - fee);
                  return (
                    <tr key={o.id}>
                      <td>{new Date(o.createdAt).toLocaleString("fr-FR")}</td>
                      <td className="max-w-[22rem]">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{o.symbol}</span>
                          <span className="badge badge-ghost">
                            {o.currency || "EUR"}{o.currency && o.currency!=="EUR" ? ` → EUR ≈ ${Number(o.rateToEUR||1).toFixed(4)}` : ""}
                          </span>
                        </div>
                      </td>
                      <td><span className={`badge ${o.side==="BUY"?"badge-success":"badge-error"}`}>{o.side}</span></td>
                      <td>{qty}</td>
                      <td>{priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €</td>
                      <td>{fee > 0 ? fee.toLocaleString("fr-FR",{minimumFractionDigits:2, maximumFractionDigits:4})+" €" : "0 €"}</td>
                      <td>{total.toLocaleString("fr-FR",{maximumFractionDigits:2})} €</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes mobiles */}
          <div className="md:hidden space-y-3">
            {safeRows.map((o) => {
              const qty = Number(o.quantity||0);
              const priceEUR = Number.isFinite(Number(o.priceEUR)) ? Number(o.priceEUR)
                                : Number(o.price||0) * (Number(o.rateToEUR||1) || 1);
              const fee = Number(o.feeEUR || 0);
              const total = Number.isFinite(Number(o.totalEUR)) ? Number(o.totalEUR)
                            : (o.side==="BUY" ? qty*priceEUR + fee : qty*priceEUR - fee);
              return (
                <div key={o.id} className="rounded-2xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs opacity-70">{new Date(o.createdAt).toLocaleString("fr-FR")}</div>
                    <span className={`badge ${o.side==="BUY"?"badge-success":"badge-error"}`}>{o.side}</span>
                  </div>
                  <div className="mt-1 font-semibold break-words">{o.symbol}</div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div><div className="opacity-70">Qté</div><div className="font-medium">{qty}</div></div>
                    <div><div className="opacity-70">Prix</div><div className="font-medium">{priceEUR.toLocaleString("fr-FR",{maximumFractionDigits:4})} €</div></div>
                    <div><div className="opacity-70">Frais</div><div className="font-medium">{fee.toLocaleString("fr-FR",{maximumFractionDigits:2})} €</div></div>
                    <div><div className="opacity-70">Total net</div><div className="font-medium">{total.toLocaleString("fr-FR",{maximumFractionDigits:2})} €</div></div>
                  </div>
                  <div className="mt-2 text-[11px] opacity-60">
                    {o.currency || "EUR"}{o.currency && o.currency!=="EUR" ? ` → EUR ≈ ${Number(o.rateToEUR||1).toFixed(4)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}
    </section>
  );
}

/* ====== Portfolio principal ====== */
export default function Portfolio() {
  const [data, setData] = useState({ positions: [], cash: 0, positionsValue: 0, equity: 0 });
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/portfolio");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (alive) setData(j);
      } catch {
        if (alive) { setErr("Impossible de charger le portefeuille"); setData({ positions: [], cash: 0, positionsValue: 0, equity: 0 }); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = Array.isArray(data?.positions) ? data.positions : [];
  const cash = Number(data?.cash ?? 0);
  const positionsValue = Number(data?.positionsValue ?? 0);
  const equity = Number.isFinite(Number(data?.equity)) ? Number(data.equity) : positionsValue + cash;

  const costEUR = rows.reduce((s, p) => s + Number(p.avgPriceEUR || 0) * Number(p.quantity || 0), 0);
  const pnlTotal = positionsValue - costEUR;
  const pnlPct   = costEUR > 0 ? (pnlTotal / costEUR) * 100 : 0;

  const spot = rows.filter(p => !String(p.symbol).includes("::LEV:") && !String(p.symbol).includes("::OPT:"));
  const plus = rows.filter(p =>  String(p.symbol).includes("::LEV:") ||  String(p.symbol).includes("::OPT:"));

  async function quickClose(id, qty) {
    try {
      const r = await fetch("/api/close-plus", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ positionId: id, quantity: qty })
      });
      await r.json().catch(()=> ({}));
      const r2 = await fetch("/api/portfolio");
      const j2 = await r2.json();
      setData(j2);
    } catch {}
  }

  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        {/* Header + stats */}
        <section className="col-span-12">
          <GlassPanel>
            <h1 className="text-2xl md:text-3xl font-bold mb-4">Portefeuille</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat rounded-xl">
                <div className="stat-title">Valorisation positions</div>
                <div className="stat-value text-lg md:text-2xl">
                  {positionsValue.toLocaleString("fr-FR",{maximumFractionDigits:2})} €
                </div>
              </div>
              <div className="stat rounded-xl">
                <div className="stat-title">Cash</div>
                <div className="stat-value text-lg md:text-2xl">
                  {cash.toLocaleString("fr-FR",{maximumFractionDigits:2})} €
                </div>
              </div>
              <div className="stat rounded-xl">
                <div className="stat-title">Équity totale</div>
                <div className="stat-value text-lg md:text-2xl">
                  {equity.toLocaleString("fr-FR",{maximumFractionDigits:2})} €
                </div>
              </div>
              <div className="stat rounded-xl">
                <div className="stat-title">Perf globale</div>
                <div className="stat-value text-lg md:text-2xl">
                  <PerfBadge value={pnlPct} />
                </div>
              </div>
            </div>
            {err && <div className="alert alert-warning mt-4">{err}</div>}
          </GlassPanel>
        </section>

        {/* SPOT */}
        <section className="col-span-12">
          <GlassPanel>
            <h2 className="text-xl font-semibold mb-2">Positions Spot</h2>
            {spot.length === 0 ? (
              <div className="opacity-70">Aucune position Spot.</div>
            ) : (
              <>
                {/* Cartes mobiles */}
                <div className="md:hidden space-y-3">
                  {spot.map((p,i)=> <SpotMobileCard key={p.symbol || i} p={p} />)}
                </div>

                {/* Tableau desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr><th>Symbole</th><th>Nom</th><th>Qté</th><th>Prix moyen</th><th>Dernier</th><th>P&L %</th></tr>
                    </thead>
                    <tbody>
                      {spot.map((p,i)=>{
                        const q=Number(p.quantity||0), avg=Number(p.avgPriceEUR||0), last=Number(p.lastEUR||0);
                        const pct = (avg>0 && Number.isFinite(last)) ? ((last-avg)/avg)*100 : 0;
                        return (
                          <tr key={p.symbol||i}>
                            <td>{p.symbol}</td>
                            <td className="max-w-[26rem]">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{p.name || "—"}</span>
                                <span className="badge badge-ghost">{p.currency||"EUR"}</span>
                              </div>
                            </td>
                            <td>{q}</td>
                            <td>{avg?`${avg.toFixed(2)} €`:"—"}</td>
                            <td>{Number.isFinite(last)&&last>0?`${last.toFixed(2)} €`:"—"}</td>
                            <td><PerfBadge value={pct} compact/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </GlassPanel>
        </section>

        {/* PLUS */}
        <section className="col-span-12">
          <GlassPanel>
            <h2 className="text-xl font-semibold mb-2">Positions EDB Plus</h2>
            {plus.length === 0 ? (
              <div className="opacity-70">Aucune position Plus.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plus.map((p)=>{
                  const meta = parseExtSymbol(p.symbol);
                  const chip = meta.kind==="LEV" ? `${meta.side} ${meta.lev}x` : meta.kind==="OPT" ? `${meta.side}` : "SPOT";
                  const avg = Number(p.avgPriceEUR || p.avgPrice || 0);
                  const last= Number(p.lastEUR || 0);
                  const qty = Number(p.quantity || 0);

                  let pnlLabel = "—", pnlColor = "";
                  if (meta.kind === "LEV" && Number.isFinite(last) && avg>0) {
                    const pnlAbs = (last - avg) * qty * sideFactor(meta.side);
                    const margin = (avg * qty) / (meta.lev || 1);
                    const pct = margin>0 ? (pnlAbs/margin)*100 : 0;
                    pnlLabel = `${pnlAbs>=0?"+":""}${pnlAbs.toFixed(2)} € · ${pct>=0?"+":""}${pct.toFixed(2)}%`;
                    pnlColor = pnlAbs>=0 ? "text-green-500" : "text-red-500";
                  } else if (meta.kind === "OPT" && Number.isFinite(last) && avg>0) {
                    const intrinsic = (meta.side==="CALL" ? Math.max(0, last-avg) : Math.max(0, avg-last)) * qty;
                    pnlLabel = `${intrinsic>=0?"+":""}${intrinsic.toFixed(2)} € (intrinsèque)`;
                    pnlColor = intrinsic>=0 ? "text-green-500" : "text-red-500";
                  }

                  return (
                    <div key={p.symbol} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{meta.base}</div>
                        <span className="badge badge-ghost">{chip}</span>
                      </div>
                      <div className="text-sm opacity-80 mt-1">
                        Qté {qty} · Prix moy. {avg.toFixed(4)} € · Dernier {Number.isFinite(last)?last.toFixed(4):"…"} €
                      </div>
                      <div className={`mt-2 font-semibold ${pnlColor}`}>{pnlLabel}</div>

                      <div className="mt-3 flex items-center gap-2">
                        <button className="btn btn-outline btn-sm" onClick={()=>quickClose(p.id, undefined)}>Fermer</button>
                        <button className="btn btn-error btn-sm" onClick={()=>quickClose(p.id, p.quantity)}>Tout fermer</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        </section>

        {/* Historique */}
        <section className="col-span-12">
          <OrdersHistory />
        </section>
      </div>
    </PageShell>
  );
}