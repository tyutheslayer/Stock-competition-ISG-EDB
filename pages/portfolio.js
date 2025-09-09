import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";

export default function Portfolio() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/portfolio");
      if (r.ok) setData(await r.json());
    })();
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Portefeuille</h1>

        {/* Barre d’actions */}
        <div className="mt-4 flex gap-2">
          <a className="btn bg-primary text-white" href="/api/portfolio/export">
            Exporter CSV
          </a>
          <a className="btn" href="/orders">Historique</a>
          <a className="btn" href="/watchlist">Watchlist</a>
        </div>

        {!data ? (
          <div className="skeleton h-28 w-full max-w-3xl mt-6"></div>
        ) : (
          <>
            <div className="w-full max-w-3xl mt-6 p-5 rounded-2xl shadow bg-base-100 text-left overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Symbole</th>
                    <th>Nom</th>
                    <th>Quantité</th>
                    <th>Prix moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.symbol}</td>
                      <td>{p.name}</td>
                      <td>{p.quantity}</td>
                      <td>{p.avgPrice.toFixed(2)}</td>
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
