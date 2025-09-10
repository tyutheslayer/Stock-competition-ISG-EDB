export default function PerfBadge({ value, className = "", compact = false }) {
  const v = Number(value);
  if (!Number.isFinite(v)) {
    return <span className={"badge"}>—</span>;
  }
  const up = v > 0;
  const zero = v === 0;

  // DaisyUI badges (success/error) + variante neutre
  const base = "badge";
  const tone = zero ? "badge-ghost" : up ? "badge-success" : "badge-error";

  // Format : ▲ 1.23%  /  ▼ 0.80%
  const arrow = zero ? "•" : up ? "▲" : "▼";
  const text = `${arrow} ${Math.abs(v).toFixed(2)}%`;

  // compact = badge plus discret (optionnel)
  const size = compact ? "text-xs" : "text-sm";

  return (
    <span className={`${base} ${tone} ${size} ${className}`.trim()}>
      {text}
    </span>
  );
}
