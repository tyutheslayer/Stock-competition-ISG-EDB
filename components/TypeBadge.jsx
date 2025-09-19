// components/TypeBadge.jsx
import { Lock } from "lucide-react";

const TYPE_STYLES = {
  MINI_COURSE: "badge-info",
  PLUS_SESSION: "badge-primary",
  EDB_NIGHT: "badge-accent",
  PARTNER_TALK: "badge-warning",
  MASTERMIND: "badge-error",
  ROADTRIP: "badge-success",
  OTHER: "badge-neutral",
};

export default function TypeBadge({ type, plusOnly }) {
  const cls = TYPE_STYLES[type] || "badge-ghost";
  return (
    <div className="flex items-center gap-1">
      <span className={`badge ${cls} whitespace-nowrap`}>{type.replaceAll("_", " ")}</span>
      {plusOnly && (
        <span className="tooltip" data-tip="Réservé aux membres Plus">
          <Lock size={14} />
        </span>
      )}
    </div>
  );
}