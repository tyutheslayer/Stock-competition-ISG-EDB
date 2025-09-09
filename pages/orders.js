import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";

export default function Orders() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/orders");
      if (r.ok) setRows(await r.json());
    })();
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page py-8">
        <h1 className="text-3xl font-bold text-primary text-center">Historique d’ordres</h1>
        {!rows ? (
          <div className="skeleton h-24 w-full max-w-3xl mx-auto mt-6"></div>
        ) : (
          <div className="w-full max-w-3xl mx-auto mt-6 p-5 rounded-2xl shadow bg-base-100 overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbole</th>
                  <th>Côté</th>
                  <th>Qté</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(o => (
                  <tr key={o.id}>
                    <td>{new Date(o.createdAt).toLocaleString()}</td>
                    <td>{o.symbol}</td>
                    <td>{o.side}</td>
                    <td>{o.quantity}</td>
                    <td>{o.price?.toFixed?.(4) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
