// pages/plus/sheets.jsx
import { useEffect, useState } from "react";
import PageShell from "../../components/PageShell";
import GlassPanel from "../../components/GlassPanel";

export default function PlusSheets() {
  const [status, setStatus] = useState("loading"); // loading | ok | blocked
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await fetch("/api/plus/status").then(r => r.json()).catch(() => ({ status: "none" }));
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
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        {/* En-tête */}
        <section className="col-span-12">
          <GlassPanel>
            <h1 className="text-3xl font-bold mb-2">Fiches synthèse</h1>
            <p className="opacity-80">
              Accède aux fiches PDF préparées pour t’aider à analyser rapidement une valeur
              (résumés, KPI clés, notes de lecture…).
            </p>
          </GlassPanel>
        </section>

        {/* États d’accès */}
        {status === "blocked" && (
          <section className="col-span-12">
            <GlassPanel className="alert alert-warning mb-0">
              <span>
                Contenu réservé aux membres Plus.{" "}
                <a href="/plus" className="link link-primary">En savoir plus</a>
              </span>
            </GlassPanel>
          </section>
        )}

        {status === "loading" && (
          <section className="col-span-12">
            <GlassPanel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/20 bg-white/5 p-4">
                    <div className="skeleton h-5 w-2/3 mb-2" />
                    <div className="skeleton h-4 w-1/3" />
                    <div className="mt-4 flex gap-2">
                      <div className="skeleton h-9 w-28" />
                      <div className="skeleton h-9 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </section>
        )}

        {/* Liste des fiches (status === ok) */}
        {status === "ok" && (
          <section className="col-span-12">
            <GlassPanel>
              {err && <div className="alert alert-error mb-4">{err}</div>}

              {rows.length === 0 ? (
                <div className="opacity-70">Aucune fiche disponible pour le moment.</div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rows.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-2xl border border-white/20 bg-white/5 p-4 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="font-semibold">{f.title}</h3>
                        <div className="text-xs opacity-70">
                          {new Date(f.createdAt).toLocaleString("fr-FR")}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          className="btn btn-primary btn-sm"
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ouvrir
                        </a>
                        <a className="btn btn-outline btn-sm" href={f.url} download>
                          Télécharger PDF
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </section>
        )}
      </div>
    </PageShell>
  );
}