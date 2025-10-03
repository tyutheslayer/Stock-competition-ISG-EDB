// pages/leaderboard.js
import { useEffect, useState } from "react";
import PerfBadge from "../components/PerfBadge";
import BadgePill from "../components/BadgePill";
import PageShell from "../components/PageShell";
import GlassPanel from "../components/GlassPanel";

const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];

export default function LeaderboardPage() {
  const [promo, setPromo] = useState("");
  const [period, setPeriod] = useState("season"); // day | week | month | season
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // badgesByUser: { [userId]: Badge[] }
  const [badgesByUser, setBadgesByUser] = useState({});

  async function load(first = false) {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", first ? "0" : String(offset));
      if (promo.trim()) params.set("promo", promo.trim());
      params.set("period", period);

      const r = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();

      const batch = Array.isArray(data) ? data : (data.rows || []);
      if (first) {
        setRows(batch);
      } else {
        setRows(prev => [...prev, ...batch]);
      }
      const n = Array.isArray(data) ? null : data.nextOffset ?? null;
      setNextOffset(n);
      setOffset(first ? (batch.length || 0) : (n ?? offset));
    } catch (e) {
      setErr("Impossible de charger le classement");
      if (first) { setRows([]); setNextOffset(null); }
    } finally {
      setLoading(false);
    }
  }

  // (Re)charger le leaderboard quand promo/période changent
  useEffect(() => {
    setOffset(0);
    setBadgesByUser({}); // reset cache badges quand la période change
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promo, period]);

  // Charger les badges pour les lignes visibles (manque = non en cache)
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const ids = rows.map(r => r.userId).filter(Boolean);
    const missing = ids.filter(id => !badgesByUser[id]);
    if (missing.length === 0) return;

    let alive = true;
    (async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const r = await fetch(`/api/badges?userId=${encodeURIComponent(id)}&period=${encodeURIComponent(period)}`);
            const j = await r.json();
            return { id, badges: Array.isArray(j?.badges) ? j.badges : [] };
          } catch {
            return { id, badges: [] };
          }
        })
      );
      if (!alive) return;
      setBadgesByUser(prev => {
        const next = { ...prev };
        for (const { id, badges } of results) next[id] = badges;
        return next;
      });
    })();

    return () => { alive = false; };
  }, [rows, period, badgesByUser]);

  function onFilter(e) {
    e.preventDefault();
    setOffset(0);
    setBadgesByUser({});
    load(true);
  }

  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12">
          <GlassPanel>
            <h1 className="text-3xl font-bold mb-2">Classement</h1>
            <p className="opacity-80">
              Compare tes performances par période et par promo. Les badges s’affichent sous chaque joueur.
            </p>
          </GlassPanel>
        </section>

        {/* Filtres */}
        <section className="col-span-12">
          <GlassPanel as="form" onSubmit={onFilter} className="flex flex-wrap items-end gap-3">
            <label className="form-control w-60">
              <span className="label-text">Promo</span>
              <select
                className="select select-bordered"
                value={promo}
                onChange={e => setPromo(e.target.value)}
              >
                <option value="">Toutes</option>
                {ALLOWED_PROMOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            {/* Sélecteur de période */}
            <div className="form-control">
              <span className="label-text">Période</span>
              <div className="join">
                {[
                  { key: "day", label: "Jour" },
                  { key: "week", label: "Semaine" },
                  { key: "month", label: "Mois" },
                  { key: "season", label: "Saison" },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`btn join-item ${period === p.key ? "btn-primary" : ""}`}
                    onClick={() => setPeriod(p.key)}
                    disabled={loading}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "…" : "Filtrer"}
            </button>
          </GlassPanel>
        </section>

        {/* Tableau */}
        <section className="col-span-12">
          <GlassPanel className="overflow-x-auto">
            {err && <div className="alert alert-warning mb-3">{err}</div>}

            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nom</th>
                  <th>Equity</th>
                  <th>Perf {({day:"(jour)",week:"(semaine)",month:"(mois)",season:"(saison)"}[period])}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const userBadges = badgesByUser[r.userId] || [];
                  // Compat perf: accepte perf ∈ [0,1] ou % déjà calculé
                  const perfPct = (typeof r.perf === "number" && r.perf <= 1) ? r.perf * 100 : Number(r.perf ?? 0);

                  return (
                    <tr key={r.userId || r.id || r.email || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="font-medium">{r.name || r.email || "—"}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {userBadges.length > 0
                            ? userBadges.map((b, i) => <BadgePill key={i} badge={b} />)
                            : <span className="text-xs opacity-40">—</span>}
                        </div>
                      </td>
                      <td>{Number(r.equity ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      <td><PerfBadge value={perfPct} /></td>
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-8 opacity-60">Aucun résultat</td></tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 flex justify-center">
              {nextOffset != null ? (
                <button className="btn" onClick={() => load(false)} disabled={loading}>
                  {loading ? "…" : "Charger plus"}
                </button>
              ) : (
                <span className="opacity-60 text-sm">Fin du classement</span>
              )}
            </div>
          </GlassPanel>
        </section>
      </div>
    </PageShell>
  );
}