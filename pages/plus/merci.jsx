// pages/plus/merci.jsx
import { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";

export default function Merci() {
  const [status, setStatus] = useState("checking");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/sumup/verify");
        const j = await r.json();
        if (!alive) return;
        if (r.ok && j?.status === "active") setStatus("active");
        else if (r.ok && j?.status === "pending") setStatus("pending");
        else setStatus("failed");
      } catch {
        if (alive) { setErr("Vérification impossible."); setStatus("failed"); }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Merci 🙏</h1>
        {status === "checking" && <div className="opacity-70">Vérification en cours…</div>}
        {status === "pending" && <div className="opacity-70">
          Paiement en cours de confirmation… Recharge la page dans quelques secondes.
        </div>}
        {status === "active" && (
          <div className="alert alert-success">
            Paiement confirmé. Ton abonnement <b>EDB Plus</b> est actif !
          </div>
        )}
        {status === "failed" && (
          <div className="alert alert-warning">
            Paiement non confirmé. Si tu as bien payé, réessaie dans une minute.
          </div>
        )}
        {err && <div className="mt-3 text-error">{err}</div>}
      </main>
    </div>
  );
}