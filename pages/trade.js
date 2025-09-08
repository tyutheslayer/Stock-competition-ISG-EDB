import { getSession, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

function SearchBox({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  async function onSearch(e) {
    e.preventDefault();
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    setRes(Array.isArray(data) ? data : []);
  }
  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={onSearch} className="flex gap-2">
        <input className="input input-bordered flex-1" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher (ex: Airbus, AAPL, AIR.PA)" />
        <button className="btn bg-primary text-white" type="submit">Rechercher</button>
      </form>
      <div className="mt-3 space-y-1">
        {res.map(item => (
          <button key={item.symbol} type="button"
            className="w-full text-left p-2 rounded hover:bg-base-200"
            onClick={() => onPick(item)}>
            <b>{item.symbol}</b> — {item.shortname}
            <span className="badge mx-2">{item.exchange}</span>
            <span className="badge">{item.currency}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Trade() {
  const { data: session } = useSession();
  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!picked) return;
    let alive = true;
    async function load() {
      const r = await fetch(`/api/quote/${encodeURIComponent(picked.symbol)}`);
      const data = await r.json();
      if (alive) setQuote(data);
    }
    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [picked]);

  async function submit(side) {
    if (!picked) return;
    setMsg("");
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: picked.symbol, side, qty: Number(qty) })
    });
    setMsg(r.ok ? "✅ Ordre exécuté (simulé)." : "❌ " + (await r.text()));
  }

  return (
    <div>
      <NavBar />
      <main className="page py-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-primary">Trading</h1>
        {!session && <div className="alert alert-warning mt-4 w-full max-w-2xl">Vous devez être connecté.</div>}
        <div className="mt-5 w-full flex flex-col items-center">
          <SearchBox onPick={setPicked} />
          {picked && (
            <div className="mt-6 w-full max-w-2xl p-5 rounded-2xl shadow bg-base-100 text-left">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xl font-semibold">{picked.symbol} — {quote?.name || picked.shortname}</h3>
                  <div className="stats shadow">
                    <div className="stat">
                      <div className="stat-title">Dernier prix</div>
                      <div className="stat-value text-primary">{quote?.price ?? "…"}</div>
                      <div className="stat-desc">{quote?.currency}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input className="input input-bordered w-32" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
                  <button className="btn bg-primary text-white" onClick={() => submit("BUY")}>Acheter</button>
                  <button className="btn btn-outline" onClick={() => submit("SELL")}>Vendre</button>
                </div>
                {msg && <div className="mt-2">{msg}</div>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}
