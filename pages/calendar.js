// pages/calendar.js
import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";

const TYPE_LABEL = {
  MINI_COURSE: "Mini-cours",
  PLUS_SESSION: "Session Plus",
  EDB_NIGHT: "EDB Night",
  PARTNER_TALK: "Partenariat",
  MASTERMIND: "Mastermind",
  ROADTRIP: "Road Trip",
  OTHER: "Autre",
};

const VISI_LABEL = {
  PUBLIC: "Ouvert à tous",
  PLUS_ONLY: "Plus",
};

function Badge({ children, tone = "neutral" }) {
  const styles = {
    neutral: "badge badge-ghost",
    accent: "badge badge-accent",
    info: "badge badge-info",
    warn: "badge badge-warning",
    error: "badge badge-error",
    success: "badge badge-success",
    primary: "badge badge-primary",
    secondary: "badge badge-secondary",
  };
  return <span className={styles[tone] || styles.neutral}>{children}</span>;
}

function toneForType(t) {
  switch (t) {
    case "MINI_COURSE": return "primary";
    case "PLUS_SESSION": return "success";
    case "EDB_NIGHT": return "secondary";
    case "PARTNER_TALK": return "info";
    case "MASTERMIND": return "warn";
    case "ROADTRIP": return "accent";
    default: return "neutral";
  }
}

function groupByMonth(events) {
  const intl = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
  const map = new Map();
  for (const ev of events) {
    const d = new Date(ev.startsAt);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
    if (!map.has(k)) map.set(k, { key: k, label: intl.format(d), rows: [] });
    map.get(k).rows.push(ev);
  }
  // ordonner sur la clé
  return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key));
}

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("");         // filtre type
  const [visibility, setVisibility] = useState(""); // filtre visibilité
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (visibility) params.set("visibility", visibility);
      if (q.trim()) params.set("q", q.trim());

      const r = await fetch(`/api/events?${params.toString()}`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[calendar] load fail:", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // initial

  const grouped = useMemo(() => groupByMonth(events), [events]);

  return (
    <div>
      <NavBar />
      <main className="page max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">Évènements</h1>
          <a className="btn btn-outline" href="/api/events.ics">S’abonner (ICS)</a>
        </div>

        {/* Filtres */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <label className="form-control w-60">
            <span className="label-text">Type</span>
            <select className="select select-bordered" value={type} onChange={e=>setType(e.target.value)}>
              <option value="">Tous</option>
              {Object.keys(TYPE_LABEL).map(k => (
                <option key={k} value={k}>{TYPE_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="form-control w-60">
            <span className="label-text">Visibilité</span>
            <select className="select select-bordered" value={visibility} onChange={e=>setVisibility(e.target.value)}>
              <option value="">Toutes</option>
              <option value="PUBLIC">Ouvert à tous</option>
              <option value="PLUS_ONLY">Plus uniquement</option>
            </select>
          </label>
          <label className="form-control w-72">
            <span className="label-text">Recherche</span>
            <input
              className="input input-bordered"
              placeholder="titre, description, lieu…"
              value={q}
              onChange={e=>setQ(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === "Enter") load(); }}
            />
          </label>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? "Chargement…" : "Appliquer"}
          </button>
        </div>

        {/* Liste groupée par mois */}
        <div className="mt-6">
          {grouped.length === 0 && !loading && (
            <div className="alert">
              <span>Aucun évènement trouvé.</span>
            </div>
          )}
          {grouped.map(group => (
            <section key={group.key} className="mb-8">
              <h2 className="text-xl font-semibold mb-3">{group.label}</h2>
              <div className="rounded-2xl shadow bg-base-100 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Titre</th>
                      <th>Type</th>
                      <th>Visibilité</th>
                      <th>Lieu</th>
                      <th>Heures (Paris)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(ev => {
                      const start = new Date(ev.startsAt);
                      const end = ev.endsAt ? new Date(ev.endsAt) : null;
                      const df = new Intl.DateTimeFormat("fr-FR", {
                        weekday: "short", day: "2-digit", month: "short",
                      });
                      const tf = new Intl.DateTimeFormat("fr-FR", {
                        hour: "2-digit", minute: "2-digit", hour12: false,
                        timeZone: "Europe/Paris",
                      });
                      return (
                        <tr key={ev.id}>
                          <td>{df.format(start)}</td>
                          <td>
                            <div className="font-medium">{ev.title}</div>
                            {ev.description && <div className="opacity-70 text-sm">{ev.description}</div>}
                          </td>
                          <td><Badge tone={toneForType(ev.type)}>{TYPE_LABEL[ev.type] || ev.type}</Badge></td>
                          <td><Badge tone={ev.visibility === "PLUS_ONLY" ? "error" : "neutral"}>{VISI_LABEL[ev.visibility]}</Badge></td>
                          <td>{ev.location || "—"}</td>
                          <td>
                            {tf.format(start)}
                            {end ? ` → ${tf.format(end)}` : (ev.isOpenEnded ? " (ouvert)" : "")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}