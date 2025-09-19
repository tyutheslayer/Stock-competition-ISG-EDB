// components/EventCard.jsx
import TypeBadge from "./TypeBadge";
import { MapPin, Clock } from "lucide-react";

function fmtRangeISO(startISO, endISO) {
  const s = new Date(startISO);
  const e = endISO ? new Date(endISO) : null;
  const fmt = (d) =>
    d.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!e) return fmt(s);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  return sameDay ? `${fmt(s)} → ${e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : `${fmt(s)} → ${fmt(e)}`;
}

export default function EventCard({ ev }) {
  const plusOnly =
    ev.type === "PLUS_SESSION" ||
    ev.type === "EDB_NIGHT" ||
    ev.type === "MASTERMIND" ||
    ev.visibility === "PRIVATE";

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition">
      <div className="card-body gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="card-title text-lg">{ev.title}</h3>
          <TypeBadge type={ev.type} plusOnly={plusOnly} />
        </div>

        {ev.description && <p className="opacity-80">{ev.description}</p>}

        <div className="flex flex-wrap gap-3 text-sm opacity-80">
          <span className="inline-flex items-center gap-1">
            <Clock size={16} />
            {fmtRangeISO(ev.startsAt, ev.endsAt)}
          </span>
          {ev.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={16} />
              {ev.location}
            </span>
          )}
        </div>

        {/* CTA (optionnel) */}
        {/* <div className="card-actions justify-end">
          <button className="btn btn-outline btn-sm">En savoir plus</button>
        </div> */}
      </div>
    </div>
  );
}