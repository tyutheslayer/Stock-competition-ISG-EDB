import { useEffect, useState } from "react";

export default function Sparkline({ symbol, width = 80, height = 24 }) {
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/sparkline/${encodeURIComponent(symbol)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setPoints(d.points);
      } catch {}
    }
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol]);

  if (!points || points.length < 2) {
    return <div style={{width, height}} className="skeleton"></div>;
  }

  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (width - 2) + 1;
    const y = height - 1 - ((v - min) / range) * (height - 2);
    return [x, y];
  });
  const d = "M " + coords.map(([x,y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");

  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "#16a34a" : "#dc2626";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
