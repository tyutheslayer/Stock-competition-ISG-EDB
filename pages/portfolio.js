import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

export default function Portfolio() {
  const [data, setData] = useState(null);
  async function load() {
    const r = await fetch("/api/portfolio");
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div>
        <NavBar />
        <div className="container"><p>Chargement…</p></div>
      </div>
    );
  }

  return (
    <div>
      <NavBar />
      <div className="container">
        <h2>Portefeuille</h2>
        <div className="card">
          <p>Cash: <b>{data.cash.toFixed(2)}</b></p>
          <p>Équité: <b>{data.equity.toFixed(2)}</b> (capital initial: {data.startingCash.toFixed(2)})</p>
          <p>Performance cumulée: <b>{(((data.equity / data.startingCash) - 1) * 100).toFixed(2)}%</b></p>
        </div>
        <table className="table">
          <thead>
            <tr><th>Symbole</th><th>Nom</th><th>Qté</th><th>Prix moyen</th><th>Dernier</th><th>Val. marché</th><th>PnL</th><th>PnL %</th></tr>
          </thead>
          <tbody>
            {data.positions.map(p => (
              <tr key={p.id}>
                <td>{p.symbol}</td>
                <td>{p.name}</td>
                <td>{p.quantity}</td>
                <td>{p.avgPrice.toFixed(2)}</td>
                <td>{p.last ? p.last.toFixed(2) : "-"}</td>
                <td>{p.marketValue.toFixed(2)}</td>
                <td>{p.pnl.toFixed(2)}</td>
                <td>{(p.pnlPct * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}
