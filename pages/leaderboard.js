import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  async function load() {
    const r = await fetch("/api/leaderboard");
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Classement</h1>
        <div className="w-full max-w-3xl mt-6 p-5 rounded-2xl shadow bg-base-100 text-left overflow-x-auto">
          <table className="table table-zebra">
            <thead><tr><th>#</th><th>Utilisateur</th><th>Équité</th><th>Perf.</th></tr></thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{r.user}</td>
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
