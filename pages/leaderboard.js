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
      <div className="container">
        <h2>Classement</h2>
        <table className="table">
          <thead><tr><th>Utilisateur</th><th>Équité</th><th>Perf.</th></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td>{r.user}</td>
                <td>{r.equity.toFixed(2)}</td>
                <td>{(r.perf * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
