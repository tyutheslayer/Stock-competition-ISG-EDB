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
    setRes(data);
  }
  return (
    <div className="card">
      <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher une action (ex: Airbus, AAPL, AIR.PA)" />
        <button className="btn" type="submit">Rechercher</button>
      </form>
      {res.map(item => (
        <div key={item.symbol} style={{ padding: "0.5rem 0", cursor: "pointer" }} onClick={() => onPick(item)}>
          <b>{item.symbol}</b> — {item.shortname} <span className="badge">{item.exchange}</span> <span className="badge">{item.currency}</span>
        </div>
      ))}
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
    setMsg("");
    const r = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: picked.symbol, side, qty: qty })
    });
    if (r.ok) setMsg("Ordre exécuté (simulé).");
    else setMsg("Erreur: " + (await r.text()));
  }

  return (
    <div>
      <NavBar />
      <div className="container">
        <h2>Trading</h2>
        {!session && <p>Vous devez être connecté.</p>}
        <SearchBox onPick={setPicked} />
        {picked && (
          <div className="card">
            <h3>{picked.symbol} — {quote?.name || picked.shortname}</h3>
            <p>Dernier prix: <b>{quote?.price ?? "..."}</b> {quote?.currency}</p>
            <div style={{ display:"flex", gap: 8, alignItems:"center" }}>
              <input className="input" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={{ maxWidth: 120 }} />
              <button className="btn" onClick={() => submit("BUY")}>Acheter</button>
              <button className="btn" onClick={() => submit("SELL")}>Vendre</button>
            </div>
            {msg && <p>{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: "/login" } };
  return { props: {} };
}
