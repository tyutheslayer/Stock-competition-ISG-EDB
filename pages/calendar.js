// pages/calendar.js
import NavBar from "../components/NavBar";
import { useEffect, useState } from "react";

function fmtRange(start, end) {
  const s = new Date(start), e = new Date(end);
  const dd = (d) => d.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  const hh = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (s.toDateString() === e.toDateString()) {
    return `${dd(s)} • ${hh(s)}–${hh(e)}`;
  }
  return `${dd(s)} ${hh(s)} → ${dd(e)} ${hh(e)}`;
}

export default function CalendarPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=> {
    (async ()=>{
      try {
        const r = await fetch("/api/events");
        const data = await r.json();
        setRows(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">Calendrier</h1>
        <p className="opacity-70">Retrouve ici les prochains mini-cours, challenges et événements.</p>

        <div className="mt-6 rounded-2xl overflow-hidden shadow border">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Événement</th>
                <th>Type</th>
                <th>Accès</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4}>Chargement…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="text-center opacity-60 py-10">Aucun événement</td></tr>
              )}
              {rows.map(ev => (
                <tr key={ev.id}>
                  <td className="whitespace-nowrap">{fmtRange(ev.start, ev.end)}</td>
                  <td>{ev.title}</td>
                  <td><span className="badge">{ev.type || "Event"}</span></td>
                  <td>
                    {ev.access === "free" ? <span className="badge badge-success">Gratuit</span>
                      : <span className="badge badge-primary">Plus</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <a href="/register" className="btn btn-outline">S’inscrire (gratuit)</a>
          <a href="/checkout" className="btn btn-primary">Passer en Plus</a>
        </div>
      </main>
    </div>
  );
}