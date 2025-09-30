import { useMemo, useRef, useEffect, useState } from "react";

function payoff({ type, side, strike, premium, qty, S }) {
  // type: "call"|"put", side: "long"|"short", qty>0
  let value;
  if (type === "call") value = Math.max(0, S - strike);
  else value = Math.max(0, strike - S);
  const longPayoff = (value - premium) * qty;
  return side === "long" ? longPayoff : -longPayoff;
}

export default function OptionsPayoff() {
  const [type, setType] = useState("call");
  const [side, setSide] = useState("long");
  const [strike, setStrike] = useState(100);
  const [premium, setPremium] = useState(5);
  const [qty, setQty] = useState(1);
  const canvasRef = useRef(null);

  const points = useMemo(() => {
    const xs = [];
    for (let S=Math.max(0,strike-50); S<=strike+50; S+=2) {
      xs.push({ S, P: payoff({ type, side, strike:Number(strike), premium:Number(premium), qty:Number(qty), S }) });
    }
    return xs;
  }, [type, side, strike, premium, qty]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth * dpr, h = c.clientHeight * dpr;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,w,h);

    // bounds
    const xs = points.map(p=>p.S);
    const ys = points.map(p=>p.P);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padY = (maxY-minY||1)*0.2;
    const yMin = minY - padY, yMax = maxY + padY;

    const X = S => ((S-minX)/(maxX-minX))*w;
    const Y = P => h - ((P - yMin)/(yMax - yMin))*h;

    // axis
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    // x=0 axis (P=0)
    const y0 = Y(0);
    ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(w,y0); ctx.stroke();

    // curve
    ctx.beginPath();
    points.forEach((p,i)=>{ const x = X(p.S), y = Y(p.P); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.strokeStyle = side === "long" ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.9)";
    ctx.lineWidth = 2*dpr; ctx.shadowColor = "rgba(123,92,255,0.5)"; ctx.shadowBlur = 10*dpr;
    ctx.stroke();

    // strike marker
    ctx.setLineDash([6,6]); ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    const xsStrike = X(Number(strike));
    ctx.beginPath(); ctx.moveTo(xsStrike, 0); ctx.lineTo(xsStrike, h); ctx.stroke();
    ctx.setLineDash([]);

  }, [points, side, strike]);

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Simulateur payoff</div>
        <div className="text-xs opacity-70">HTML5 Canvas</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <select className="select select-bordered" value={type} onChange={e=>setType(e.target.value)}>
          <option value="call">Call</option>
          <option value="put">Put</option>
        </select>
        <select className="select select-bordered" value={side} onChange={e=>setSide(e.target.value)}>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <input className="input input-bordered" type="number" step="1" value={strike} onChange={e=>setStrike(e.target.value)} placeholder="Strike" />
        <input className="input input-bordered" type="number" step="0.1" value={premium} onChange={e=>setPremium(e.target.value)} placeholder="Prime" />
        <input className="input input-bordered" type="number" step="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Qté" />
      </div>

      <div style={{height: 240}}>
        <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
      </div>
    </div>
  );
}