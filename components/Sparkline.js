import { useEffect, useRef, useState } from "react";

export default function Sparkline({ symbol, width=200, height=40, intervalMs=15000, points=30 }) {
  const [data, setData] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    async function tick() {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
        if (!r.ok) return;
        const q = await r.json();
        const price = Number(q?.price ?? NaN);
        if (!Number.isFinite(price)) return;
        setData(prev => {
          const arr = [...prev, price];
          if (arr.length > points) arr.shift();
          return arr;
        });
      } catch {}
    }
    setData([]);
    tick();
    timer.current = setInterval(tick, intervalMs);
    return () => timer.current && clearInterval(timer.current);
  }, [symbol, intervalMs, points]);

  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const path = data.map((v,i)=>{
    const x = i*stepX;
    const y = height - ((v - min)/span)*height;
    return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const up = data[data.length-1] >= data[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`sparkline ${symbol}`}>
      <path d={path} fill="none" stroke={up ? "#16a34a" : "#dc2626"} strokeWidth="2" />
    </svg>
  );
}
