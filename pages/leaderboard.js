// pages/leaderboard.js
 import { useEffect, useState } from "react";
 import NavBar from "../components/NavBar";
 import PerfBadge from "../components/PerfBadge";

 const ALLOWED_PROMOS = ["BM1","BM2","BM3","M1","M2","Intervenant(e)","Bureau"];

 export default function LeaderboardPage() {
   const [promo, setPromo] = useState("");
+  const [period, setPeriod] = useState("season"); // day | week | month | season
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
       if (promo.trim()) params.set("promo", promo.trim());
+      params.set("period", period);

       const r = await fetch(`/api/leaderboard?${params.toString()}`);
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
     } finally {
       setLoading(false);
     }
   }

-  useEffect(() => { load(true); }, []);
+  useEffect(() => { load(true); }, [promo, period]); // recharge quand la période change

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

         <form onSubmit={onFilter} className="flex flex-wrap gap-3 items-end mb-4">
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
-          <button className="btn" type="submit" disabled={loading}>Filtrer</button>
+          {/* Sélecteur de période */}
+          <div className="join">
+            {[
+              { key: "day", label: "Jour" },
+              { key: "week", label: "Semaine" },
+              { key: "month", label: "Mois" },
+              { key: "season", label: "Saison" },
+            ].map(p => (
+              <button
+                key={p.key}
+                type="button"
+                className={`btn join-item ${period === p.key ? "btn-primary" : ""}`}
+                onClick={() => setPeriod(p.key)}
+                disabled={loading}
+              >
+                {p.label}
+              </button>
+            ))}
+          </div>
+          <button className="btn" type="submit" disabled={loading}>Filtrer</button>
         </form>

         <div className="overflow-x-auto rounded-2xl shadow bg-base-100">
           <table className="table">
             <thead>
               <tr>
                 <th>#</th>
                 <th>Nom</th>
                 <th>Equity</th>
-                <th>Perf</th>
+                <th>Perf {({day:"(jour)",week:"(semaine)",month:"(mois)",season:"(saison)"}[period])}</th>
               </tr>
             </thead>
             <tbody>
               {rows.map((r, idx) => (
                 <tr key={r.userId || r.id || r.email || idx}>
                   <td>{idx + 1}</td>
                   <td>{r.name || r.email || "—"}</td>
                   <td>{Number(r.equity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                   <td><PerfBadge value={Number(r.perf ?? 0) * 100} /></td>
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