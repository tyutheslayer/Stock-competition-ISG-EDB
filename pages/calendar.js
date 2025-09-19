// pages/calendar.js
import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import EventCard from "../components/EventCard";

const TYPES = [
  "MINI_COURSE",
  "PLUS_SESSION",
  "EDB_NIGHT",
  "PARTNER_TALK",
  "MASTERMIND",
  "ROADTRIP",
  "OTHER",
];

function groupByMonth(events) {
  const by = new Map();
  for (const ev of events) {
    const d = new Date(ev.startsAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(ev);
  }
  // tri interne par date
  for (const [, arr] of by) {
    arr.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }
  // tri des groupes
  return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function CalendarPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [types, setTypes] = useState(() => new Set(TYPES)); // tous cochés par défaut
  const [plusOnly, setPlusOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/events");
        const j = await r.json();
        if (alive) setAll(Array.isArray(j) ? j : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((ev) => {
      if (plusOnly) {
        const isPlus =
          ev.type === "PLUS_SESSION" ||
          ev.type === "EDB_NIGHT" ||
          ev.type === "MASTERMIND" ||
          ev.visibility === "PRIVATE";
        if (!isPlus) return false;
      }
      if (!types.has(ev.type)) return false;
      if (!needle) return true;
      const blob = `${ev.title || ""} ${ev.description || ""} ${ev.location || ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [all, q, types, plusOnly]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  function toggleType(t) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="text-3xl font-bold">Calendrier des évènements</h1>
          <div className="text-sm opacity-70">Fuseau horaire : Europe/Paris</div>
        </div>

        {/* Filtres */}
        <div className="rounded-2xl shadow bg-base-100 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="form-control w-72">
              <span className="label-text">Recherche</span>
              <input
                className="input input-bordered"
                placeholder="Ex : cours, night, luxembourg…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <div className="form-control">
              <span className="label-text">Visibilité</span>
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="toggle"
                  checked={plusOnly}
                  onChange={() => setPlusOnly((v) => !v)}
                />
                <span className="label-text">Uniquement “Plus”</span>
              </label>
            </div>
          </div>

          <div className="divider my-3" />

          {/* Types */}
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`btn btn-sm ${types.has(t) ? "btn-primary" : "btn-ghost"}`}
              >
                {t.replaceAll("_", " ")}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setTypes(new Set(TYPES))}
            >
              Tout
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setTypes(new Set())}
            >
              Aucun
            </button>
          </div>
        </div>

        {/* Liste groupée */}
        {loading ? (
          <div className="flex items-center gap-2 opacity-70">
            <span className="loading loading-spinner loading-sm" /> Chargement…
          </div>
        ) : grouped.length === 0 ? (
          <div className="opacity-70">Aucun évènement trouvé.</div>
        ) : (
          grouped.map(([monthKey, events]) => {
            const [y, m] = monthKey.split("-");
            const title = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            });
            return (
              <section key={monthKey} className="mb-8">
                <h2 className="text-xl font-semibold mb-3 capitalize">{title}</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((ev) => (
                    <EventCard key={ev.id} ev={ev} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}