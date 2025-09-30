import { getSession } from "next-auth/react";
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import PlusThemeProvider from "../components/PlusThemeProvider";


export default function Watchlist() {
  const [items, setItems] = useState(null);

  async function load() {
    const r = await fetch("/api/watchlist");
    if (r.ok) setItems(await r.json());
  }

  useEffect(()=>{ load(); },[]);

  async function remove(symbol){
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ symbol })
    });
    load();
  }

  return (
    <div>
      <NavBar />
      <main className="page py-8">
        <h1 className="text-3xl font-bold text-primary text-center">Watchlist</h1>
        {!items ? (
          <div className="skeleton h-24 w-full max-w-3xl mx-auto mt-6"></div>
        ) : (
          <div className="w-full max-w-3xl mx-auto mt-6 p-5 rounded-2xl shadow bg-base-100 overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>Symbole</th><th>Nom</th><th></th></tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td>{it.symbol}</td>
                    <td>{it.name || "-"}</td>
                    <td className="text-right">
                      <button className="btn btn-sm" onClick={()=>remove(it.symbol)}>Retirer</button>
                    </td>
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

export async function getServerSideProps(ctx){
  const s = await getSession(ctx);
  if (!s) return { redirect: { destination: "/login" } };
  return { props: {} };
}
