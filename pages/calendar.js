// pages/calendar.js
import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import { CalendarDays, Clock, Lock, MapPin, Download } from "lucide-react";

const TYPE_LABEL = {
  MINI_COURSE: "Cours",
  PLUS_SESSION: "Plus",
  EDB_NIGHT: "EDB Night",
  PARTNER_TALK: "Partenariat",
  MASTERMIND: "Mastermind",
  ROADTRIP: "Road Trip",
  OTHER: "Autre",
};

const TYPE_CLASS = {
  MINI_COURSE: "badge-primary",
  PLUS_SESSION: "badge-secondary",
  EDB_NIGHT: "badge-accent",
  PARTNER_TALK: "badge-info",
  MASTERMIND: "badge-warning",
  ROADTRIP: "badge-success",
  OTHER: "badge-ghost",
};

function fmtRange(start, end) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts = { hour: "2-digit", minute: "2-digit" };
  const dOpts = { weekday: "short", day: "2-digit", month: "short", year: "numeric" };
  const day = s.toLocaleDateString("fr-FR", dOpts);
  const t1 = s.toLocaleTimeString("fr-FR", opts);
  const t2 = e ? e.toLocaleTimeString("fr-FR", opts) : "open-end";
  return { day, t1, t2 };
}

function groupByMonth(rows) {
  const groups = new Map();
  for (const r of rows) {
    const d = new Date(r.startsAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, list }));
}

export default function CalendarPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL or specific type
  const [includePlus, setIncludePlus] = useState(true); // afficher Plus/private

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        setRows(null);
        const params = new URLSearchParams();
        // tu peux ajouter ?from= & ?to= si besoin
        const r = await fetch(`/api/events?${params.toString()}`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[calendar] fetch err:", e);
        if (alive) { setErr("Impossible de charger les évènements"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    return list.filter(ev => {
      if (!includePlus && (ev.isPlusOnly)) return false;
      if (filterType !== "ALL" && ev.type !== filterType) return false;
      return true;
    });
  }, [rows, includePlus, filterType]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="text-3xl font-bold">Calendrier des évènements</h1>
          <a
            href="/api/events?format=ics"
            className="btn btn-outline"
            title="Exporter en .ics"
          >
            <Download className="w-4 h-4 mr-2" />
            Export .ics
          </a>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <label className="form-control">
            <span className="label-text">Type</span>
            <select
              className="select select-bordered"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">Tous</option>
              {Object.keys(TYPE_LABEL).map(t => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="label cursor-pointer gap-2">
            <span className="label-text">Inclure événements “Plus”</span>
            <input
              type="checkbox"
              className="toggle"
              checked={includePlus}
              onChange={(e) => setIncludePlus(e.target.checked)}
            />
          </label>
        </div>

        {err && <div className="alert alert-warning mb-4">{err}</div>}

        {groups.length === 0 ? (
          <div className="text-gray-500">Aucun évènement à afficher.</div>
        ) : (
          groups.map(({ key, list }) => {
            const [y, m] = key.split("-");
            const monthName = new Date(Date.UTC(Number(y), Number(m) - 1, 1))
              .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
            return (
              <section key={key} className="mb-8">
                <h2 className="text-xl font-semibold capitalize mb-3">{monthName}</h2>
                <div className="space-y-3">
                  {list.map(ev => {
                    const { day, t1, t2 } = fmtRange(ev.startsAt, ev.endsAt);
                    const badgeType = TYPE_CLASS[ev.type] || "badge-ghost";
                    const typeLabel = TYPE_LABEL[ev.type] || ev.type;
                    return (
                      <div key={ev.id} className="rounded-2xl shadow bg-base-100 p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className={`badge ${badgeType}`}>{typeLabel}</span>
                            {ev.isTdb && <span className="badge badge-outline">TDB</span>}
                            {ev.isPlusOnly && (
                              <span className="badge badge-outline">
                                <Lock className="w-3 h-3 mr-1" /> Plus
                              </span>
                            )}
                          </div>
                          <div className="text-sm opacity-70 flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            <span>{day}</span>
                            <Clock className="w-4 h-4 ml-2" />
                            <span>{t1} — {t2}</span>
                            {ev.location && (
                              <>
                                <MapPin className="w-4 h-4 ml-2" />
                                <span>{ev.location}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <h3 className="mt-2 text-lg font-medium">{ev.title}</h3>
                        {ev.description && (
                          <p className="mt-1 opacity-80 whitespace-pre-line">{ev.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}