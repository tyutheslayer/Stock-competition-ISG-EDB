import { useEffect, useState } from "react";

export default function Toast({ text, ok=true, ms=2000, onDone }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone?.(); }, ms);
    return () => clearTimeout(t);
  }, [ms, onDone]);
  if (!show) return null;

  return (
    <div className="toast toast-end z-50">
      <div className={`alert ${ok ? "alert-success" : "alert-error"}`}>
        <span>{text}</span>
      </div>
    </div>
  );
}
