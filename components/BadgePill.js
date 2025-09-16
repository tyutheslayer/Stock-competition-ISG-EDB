// components/BadgePill.jsx
export const BADGE_META = {
  top10:       { emoji: "🏅", label: "Top 10" },
  big_gainer:  { emoji: "🚀", label: "+5% période" },
  active_trader:{ emoji: "⚡️", label: "Trader actif" },
  comeback:    { emoji: "🧩", label: "Comeback" },
};

export default function BadgePill({ badge }) {
  // badge peut être { id, label?, emoji? } ou un id string
  let id, label, emoji;
  if (typeof badge === "string") {
    id = badge;
    ({ label, emoji } = BADGE_META[id] || { label: id, emoji: "🔖" });
  } else {
    id = badge?.id;
    const meta = BADGE_META[id] || {};
    emoji = badge?.emoji || meta.emoji || "🔖";
    label = badge?.label || meta.label || id;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-base-200">
      <span aria-hidden>{emoji}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}