// components/EventCard.jsx
import Link from "next/link";

function fmt(dt) {
  const d = new Date(dt);
  return d.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABEL = {
  MINI_COURSE: "Mini-cours",
  PLUS_SESSION: "Session Plus",
  EDB_NIGHT: "EDB Night",
  PARTNER_TALK: "Partenariat",
  MASTERMIND: "Mastermind",
  ROADTRIP: "Road Trip",
  OTHER: "Autre",
};

export default function EventCard({ ev, isPlusActive = false }) {
  const isPlusOnly = ev.visibility === "PLUS";
  const locked = isPlusOnly && !isPlusActive;

  return (
    <div className={`card bg-base-100 shadow ${locked ? "opacity-80" : ""}`}>
      <div className="card-body">
        <div className="flex items-center gap-2">
          <div className={`badge ${isPlusOnly ? "badge-primary" : "badge-ghost"}`}>
            {TYPE_LABEL[ev.type] || ev.type}
          </div>
          {isPlusOnly && <div className="badge badge-outline">Plus</div>}
        </div>

        <h3 className="card-title mt-1">{ev.title}</h3>
        <div className="text-sm opacity-70">
          {fmt(ev.startsAt)} {ev.endsAt ? <>→ {fmt(ev.endsAt)}</> : null}
          {ev.location ? <> • {ev.location}</> : null}
        </div>

        {ev.description ? <p className="mt-2">{ev.description}</p> : null}

        <div className="card-actions justify-end mt-3">
          {locked ? (
            <Link href="/plus" className="btn btn-primary btn-sm">
              Débloquer avec EDB Plus
            </Link>
          ) : (
            <span className="text-sm opacity-70">Ouvert</span>
          )}
        </div>
      </div>
    </div>
  );
}