import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState({ key: "rank", dir: "asc" });

  async function load() {
    const r = await fetch("/api/leaderboard");
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  function computeName(r){
    return r.name || r.userName || (r.user?.split("@")[0] ?? r.user);
  }

  const sorted = [...rows].map((r, idx)=>({
    ...r, _rank: idx+1, _name: computeName(r)
  })).sort((a,b)=>{
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;
    const va = key==="rank"?a._rank : key==="name"?a._name.toLowerCase() : key==="equity"?a.equity : a.perf;
    const vb = key==="rank"?b._rank : key==="name"?b._name.toLowerCase() : key==="equity"?b.equity : b.perf;
    if (va<vb) return -1*dir;
    if (va>vb) return  1*dir;
    return 0;
  });

  function toggle(k){
    setSort(s => s.key===k ? { key:k, dir: (s.dir==="asc"?"desc":"asc") } : { key:k, dir:"asc" });
  }

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Classement</h1>

        <div className="mt-4">
          <a className="btn bg-primary text-white" href="/api/leaderboard/export">Exporter CSV</a>
        </div>

        <div className="w-full max-w-3xl mt-6 p-5 rounded-2xl shadow bg-base-100 text-left overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th><button className="link" onClick={()=>toggle("rank")}>#</button></th>
                <th><button className="link" onClick={()=>toggle("name")}>Nom</button></th>
                <th><button className="link" onClick={()=>toggle("equity")}>Équité</button></th>
                <th><button className="link" onClick={()=>toggle("perf")}>Perf.</button></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={idx}>
                  <td>{r._rank}</td>
                  <td>{r._name}</td>
                  <td>{r.equity.toFixed(2)}</td>
                  <td className={r.perf >= 0 ? "text-green-600" : "text-red-600"}>{(r.perf * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
