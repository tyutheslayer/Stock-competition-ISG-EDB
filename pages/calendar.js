// pages/calendar.js
import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";

const TYPE_LABEL = {
  MINI_COURSE: "Mini-cours",
  PLUS_SESSION: "Session Plus",
  EDB_NIGHT: "EDB Night",
  PARTNER_TALK: "Partenariat",
  MASTERMIND: "Mastermind",
  ROADTRIP: "Road trip",
  OTHER: "Autre",
};

function TypeBadge({ type }) {
  const base = "badge";
  const color =
    type === "MINI_COURSE" ? "badge-primary" :
    type === "PLUS_SESSION" ? "badge-accent" :
    type === "EDB_NIGHT" ? "badge-secondary" :
    type === "PARTNER_TALK" ? "badge-info" :
    type === "MASTERMIND" ? "badge-warning" :
    type === "ROADTRIP" ? "badge-success" :
    "badge-ghost";
  return <span className={`${base} ${color}`}>{TYPE_LABEL[type] || type}</span>;
}

function VisibilityChip({ v }) {
  if (v === "PLUS") return <span className="badge badge-outline">PLUS</span>;
  return <span className="badge badge-ghost">Public</span>;
}

function fmtParis(dt) {
  try {
    return new Date(dt).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(",", "");
  } catch {
    return new Date(dt).toLocaleString();
  }
}

function monthKey(dt) {
  const d = new Date(dt);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [rows, setRows] = useState(null); // null=loading
  const [type, setType] = useState("ALL");
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setRows(null);
    try {
      const params = new URLSearchParams();
      if (type && type !== "ALL") params.set("type", type);
      const r = await fetch(`/api/events?${params.toString()}`, {
        headers: { "Accept": "application/json" },
      });
      const data = await r.json().catch(() => []);
      // L'API renvoie [] en cas d'erreur interne → jamais d'exception ici
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[calendar] fetch err:", e);
      setErr("Impossible de charger les événements");
      setRows([]);
    }
  }

  useEffect(() => { load(); }, [type]);

  const groups = useMemo(() => {
    const g = new Map();
    (rows || []).forEach(ev => {
      const k = monthKey(ev.startsAt);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(ev);
    });
    for (const arr of g.values()) {
      arr.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    }
    return Array.from(g.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, arr]) => ({ key: k, items: arr }));
  }, [rows]);

  function labelMonth(key) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Calendrier EDB</h1>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="form-control w-60">
            <span className="label-text">Filtrer par type</span>
            <select
              className="select select-bordered"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="ALL">Tous</option>
              {Object.keys(TYPE_LABEL).map(k => (
                <option key={k} value={k}>{TYPE_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>

        {err && <div className="alert alert-warning mb-4">{err}</div>}

        {rows === null ? (
          <div className="rounded-2xl shadow bg-base-100 p-6">
            <div className="flex gap-3 items-center">
              <span className="loading loading-spinner loading-md" />
              <span>Chargement…</span>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl shadow bg-base-100 p-6 opacity-70">
            Aucun événement pour le moment.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map(({ key, items }) => (
              <section key={key} className="rounded-2xl shadow bg-base-100">
                <div className="px-5 py-4 border-b">
                  <h2 className="text-xl font-semibold capitalize">{labelMonth(key)}</h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map(ev => (
                      <article key={ev.id} className="p-4 rounded-xl border bg-base-200">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold truncate">{ev.title}</h3>
                          <div className="flex gap-2">
                            <TypeBadge type={ev.type} />
                            <VisibilityChip v={ev.visibility} />
                          </div>
                        </div>
                        <div className="text-sm opacity-80">
                          {fmtParis(ev.startsAt)}{ev.endsAt ? ` → ${fmtParis(ev.endsAt)}` : ""}
                        </div>
                        {ev.location && (
                          <div className="text-sm mt-1">📍 {ev.location}</div>
                        )}
                        {ev.description && (
                          <p className="text-sm mt-2 opacity-80">{ev.description}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}