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

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Portefeuille</h1>
        {!data ? (
          <div className="skeleton h-28 w-full max-w-3xl mt-6"></div>
        ) : (
          <>
            <div className="stats shadow mt-6 w-full max-w-3xl">
              <div className="stat">
                <div className="stat-title">Cash</div>
                <div className="stat-value">{data.cash.toFixed(2)}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Équité</div>
                <div className="stat-value">{data.equity.toFixed(2)}</div>
                <div className="stat-desc">Capital initial: {data.startingCash.toFixed(2)}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Perf. cumulée</div>
                <div className="stat-value">{(((data.equity / data.startingCash) - 1) * 100).toFixed(2)}%</div>
              </div>
            </div>

            <div className="w-full max-w-3xl mt-6 p-5 rounded-2xl shadow bg-base-100 text-left overflow-x-auto">
              <table className="table table-zebra">
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
                      <td className={p.pnl >= 0 ? "text-green-600" : "text-red-600"}>{p.pnl.toFixed(2)}</td>
                      <td className={p.pnlPct >= 0 ? "text-green-600" : "text-red-600"}>{(p.pnlPct * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}
