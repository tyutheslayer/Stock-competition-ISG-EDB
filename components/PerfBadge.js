export default function PerfBadge({ value }) {
  // value en décimal: 0.1234 => 12.34%
  const pct = typeof value === "number" ? value * 100 : 0;
  const up = pct >= 0;
  return (
    <span className={`badge ${up ? "badge-success" : "badge-error"}`}>
      {up ? "▲" : "▼"} {pct.toFixed(2)}%
    </span>
  );
}
