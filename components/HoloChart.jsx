import { useEffect, useRef, useState } from "react";

export default function HoloChart({ symbol = "AAPL", range = "1mo", height = 280 }) {
  const canvasRef = useRef(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/market/candles?symbol=${symbol}&range=${range}&interval=1d`);
        const j = await r.json();
        if (alive) setData(j.candles || []);
      } catch {}
    })();
    return () => { alive = false; };
  }, [symbol, range]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");

    // background
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0,0,w,h);

    // scales
    const values = data.map(d => d.c);
    const min = Math.min(...values), max = Math.max(...values);
    const pad = (max-min)*0.1 || 1;
    const yMin = min - pad, yMax = max + pad;
    const X = i => (i/(data.length-1))*w;
    const Y = v => h - ((v - yMin)/(yMax - yMin))*h;

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i=0;i<6;i++){
      const y = (i/5)*h;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }

    // glow line
    ctx.beginPath();
    data.forEach((d,i) => { const x=X(i), y=Y(d.c); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });

    ctx.strokeStyle = "rgba(123,92,255,0.5)";
    ctx.lineWidth = 2*dpr;
    ctx.shadowColor = "rgba(0,230,255,0.7)";
    ctx.shadowBlur = 12*dpr;
    ctx.stroke();

    // zero marker (last)
    const last = data[data.length-1];
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7B5CFF";
    ctx.beginPath(); ctx.arc(X(data.length-1), Y(last.c), 4*dpr, 0, Math.PI*2); ctx.fill();

  }, [data]);

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{symbol} — Graphique</div>
        <div className="text-xs opacity-70">{range}</div>
      </div>
      <div className="w-full" style={{height}}>
        <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
      </div>
    </div>
  );
}