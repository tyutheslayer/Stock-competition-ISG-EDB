import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import PerfBadge from "../components/PerfBadge";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({}); // { [email]: { name, role } }
  const [sort, setSort] = useState({ key: "rank", dir: "asc" });

  async function load() {
    const [r1, r2] = await Promise.allSettled([
      fetch("/api/leaderboard"),
      fetch("/api/leaderboard/names")
    ]);

    if (r1.status === "fulfilled" && r1.value.ok) {
      const data = await r1.value.json();
      setRows(Array.isArray(data) ? data : []);
    }
    if (r2.status === "fulfilled" && r2.value.ok) {
      const map = await r2.value.json();
      setUsers(map || {});
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  function computeName(r) {
  const u = r.user ? users[r.user] : null;
  if (u?.name) return u.name;                 // nom depuis la base
  if (r.name) return r.name;                  // ou nom renvoyé par l’API
  if (r.userName) return r.userName;          // ou autre champ
  if (r.user && r.user.includes("@")) {
    return r.user.split("@")[0];              // fallback: partie avant @
  }
  return "Joueur";
}
  function computeRole(r){
    const u = r.user ? users[r.user] : null;
    return u?.role || "USER";
  }

  const sorted = [...rows].map((r, idx)=>({
    ...r, _rank: idx+1, _name: computeName(r), _role: computeRole(r)
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
                  <td className="flex items-center gap-2">
                    <span>{r._name}</span>
                    {r._role === "ADMIN" && <span className="badge badge-success">ADMIN</span>}
                  </td>
                  <td>{r.equity.toFixed(2)}</td>
                  <td><PerfBadge value={r.perf} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
