// pages/leaderboard.js
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import PerfBadge from "../components/PerfBadge";

export default function LeaderboardPage() {
  const [school, setSchool] = useState("");
  const [promo, setPromo] = useState("");
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(first = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", first ? "0" : String(offset));
      if (school.trim()) params.set("school", school.trim());
      if (promo.trim()) params.set("promo", promo.trim());

      const r = await fetch(`/api/leaderboard?${params.toString()}`);
      const j = await r.json();
      if (first) {
        setRows(j.rows || []);
      } else {
        setRows(prev => [...prev, ...(j.rows || [])]);
      }
      setNextOffset(j.nextOffset);
      setOffset(first ? (j.rows?.length || 0) : (j.nextOffset ?? offset));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, []);

  function onFilter(e) {
    e.preventDefault();
    setOffset(0);
    load(true);
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Classement</h1>

        <form onSubmit={onFilter} className="flex flex-wrap gap-2 items-end mb-4">
          <label className="form-control w-48">
            <span className="label-text">École</span>
            <input className="input input-bordered" value={school} onChange={e=>setSchool(e.target.value)} />
          </label>
          <label className="form-control w-48">
            <span className="label-text">Promo</span>
            <input className="input input-bordered" value={promo} onChange={e=>setPromo(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={loading}>Filtrer</button>
        </form>

        <div className="overflow-x-auto rounded-2xl shadow bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nom</th>
                <th>Equity</th>
                <th>Perf</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.userId}>
                  <td>{idx + 1}</td>
                  <td>{r.name || r.email}</td>
                  <td>{r.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td><PerfBadge value={r.perf * 100} /></td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={4} className="text-center py-8 opacity-60">Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-center">
          {nextOffset != null ? (
            <button className="btn" onClick={() => load(false)} disabled={loading}>
              {loading ? "…" : "Charger plus"}
            </button>
          ) : (
            <span className="opacity-60 text-sm">Fin du classement</span>
          )}
        </div>
      </main>
    </div>
  );
}