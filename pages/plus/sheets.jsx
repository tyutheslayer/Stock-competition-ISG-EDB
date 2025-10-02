import { useEffect, useState } from "react";
import NavBar from "../../components/NavBar";

export default function PlusSheets() {
  const [status, setStatus] = useState("loading");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await fetch("/api/plus/status").then(r=>r.json()).catch(()=>({status:"none"}));
        const st = String(s?.status || "none").toLowerCase();
        if (!alive) return;
        if (st !== "active") { setStatus("blocked"); return; }
        setStatus("ok");
        const r = await fetch("/api/plus/sheets");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (alive) setRows(Array.isArray(j) ? j : []);
      } catch (e) {
        if (alive) { setErr("Impossible de charger les fiches"); setRows([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <NavBar />
      <main className="page max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Fiches synthèse</h1>

        {status === "blocked" && (
          <div className="alert alert-warning">
            <span>Réservé aux membres Plus. <a href="/plus" className="link link-primary">En savoir plus</a></span>
          </div>
        )}

        {status === "loading" && <div className="opacity-60">Chargement…</div>}

        {status === "ok" && (
          <>
            {err && <div className="alert alert-error mb-3">{err}</div>}

            {rows.length === 0 ? (
              <div className="opacity-60">Aucune fiche disponible pour le moment.</div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((f) => (
                  <li key={f.id} className="rounded-2xl shadow bg-base-100 p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold">{f.title}</h3>
                      <div className="text-xs opacity-70">
                        {new Date(f.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a className="btn btn-primary btn-sm" href={f.url} target="_blank" rel="noreferrer">Ouvrir</a>
                      <a className="btn btn-outline btn-sm" href={f.url} download>Télécharger PDF</a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}