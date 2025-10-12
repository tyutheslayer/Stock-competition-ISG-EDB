// pages/calendar.js
import { useEffect, useMemo, useState } from "react";
import PageShell from "../components/PageShell";
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
  for (const [, arr] of by) arr.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/* ========= Helpers ICS ========= */
function toICSDateUTC(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());      // ✅ (bug fixé)
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${YYYY}${MM}${DD}T${hh}${mm}${ss}Z`;
}

function eventsToICS(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EDB//Calendar//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const ev of events) {
    const uid = ev.id || `${ev.title}-${ev.startsAt}`.replace(/\s+/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}@edb`);
    lines.push(`DTSTAMP:${toICSDateUTC(new Date())}`);
    lines.push(`DTSTART:${toICSDateUTC(ev.startsAt)}`);
    if (ev.endsAt) lines.push(`DTEND:${toICSDateUTC(ev.endsAt)}`);
    if (ev.title) lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function escapeICS(s = "") {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/* Évènement de présentation : 16 octobre, 13:00–13:30 Europe/Paris */
function presentationEventForThisYear() {
  const y = new Date().getFullYear();
  // Mois 9 = octobre
  const startLocal = new Date(y, 9, 16, 13, 0, 0, 0);
  const endLocal = new Date(y, 9, 16, 13, 30, 0, 0);
  return {
    id: `presentation-${y}`,
    title: "Présentation École de la Bourse",
    description: "Séance de présentation officielle d’EDB (13h–13h30).",
    location: "Campus",
    type: "OTHER",
    visibility: "PUBLIC",
    startsAt: startLocal.toISOString(),
    endsAt: endLocal.toISOString(),
  };
}

export default function CalendarPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [types, setTypes] = useState(() => new Set(TYPES));
  const [plusOnly, setPlusOnly] = useState(false);
  const [isPlusActive, setIsPlusActive] = useState(false);

  // fetch events
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/events");
        const j = await r.json();
        let base = Array.isArray(j) ? j : [];

        // ✅ Inject "Présentation EDB" si pas déjà présente
        const pres = presentationEventForThisYear();
        const already = base.some((ev) => {
          const a = new Date(ev.startsAt);
          const b = new Date(pres.startsAt);
          return (
            ev.title?.toLowerCase().includes("présentation") &&
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
          );
        });
        if (!already) base = [...base, pres];

        if (alive) setAll(base);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // fetch plus status
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setIsPlusActive(String(j?.status).toLowerCase() === "active");
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((ev) => {
      if (plusOnly) {
        const isPlus =
          ev.type === "PLUS_SESSION" ||
          ev.type === "EDB_NIGHT" ||
          ev.type === "MASTERMIND" ||
          ev.visibility === "PLUS";
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

  function handleExportICS() {
    // Exporte uniquement les événements filtrés visibles
    const ics = eventsToICS(filtered);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "edb_calendar.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-3xl font-bold">Calendrier des évènements</h1>
          <div className="flex items-center gap-3">
            <button className="btn btn-sm btn-outline" onClick={handleExportICS} disabled={loading || filtered.length === 0}>
              {loading ? "…" : "Exporter .ics"}
            </button>
            <div className="text-sm opacity-70">
              Fuseau : Europe/Paris • Statut Plus : {isPlusActive ? "actif ✅" : "inactif 🔒"}
            </div>
          </div>
        </div>

        {/* Filtres (glass) */}
        <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-4 md:p-6 mb-8">
          <div className="flex flex-wrap items-end gap-3">
            <label className="form-control w-full sm:w-72">
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

          <div className="divider my-4" />

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
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setTypes(new Set(TYPES))}>
              Tout
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setTypes(new Set())}>
              Aucun
            </button>
          </div>
        </div>

        {/* Liste */}
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
                    <EventCard key={ev.id} ev={ev} isPlusActive={isPlusActive} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>
    </PageShell>
  );
}