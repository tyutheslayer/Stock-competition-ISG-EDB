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
      <div className="grid grid-cols-12 gap-4 sm:gap-5">
        {/* En-tête */}
        <section className="col-span-12">
          <GlassPanel>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Fiches synthèse</h1>
            <p className="opacity-80 text-sm sm:text-base">
              Accède aux fiches PDF préparées pour t’aider à analyser rapidement une valeur
              (résumés, KPI clés, notes de lecture…).
            </p>
          </GlassPanel>
        </section>

        {/* États d’accès */}
        {status === "blocked" && (
          <section className="col-span-12">
            <GlassPanel className="alert alert-warning mb-0">
              <span className="text-sm sm:text-base">
                Contenu réservé aux membres Plus.{" "}
                <a href="/plus" className="link link-primary">En savoir plus</a>
              </span>
            </GlassPanel>
          </section>
        )}

        {status === "loading" && (
          <section className="col-span-12">
            <GlassPanel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/20 bg-white/5 p-4">
                    <div className="skeleton h-5 w-3/4 mb-2" />
                    <div className="skeleton h-4 w-1/2" />
                    <div className="mt-3 flex gap-2">
                      <div className="skeleton h-9 w-28" />
                      <div className="skeleton h-9 w-36" />
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
              {err && <div className="alert alert-error mb-4 text-sm sm:text-base">{err}</div>}

              {rows.length === 0 ? (
                <div className="opacity-70 text-sm sm:text-base">Aucune fiche disponible pour le moment.</div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {rows.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-2xl border border-white/20 bg-white/5 p-4 flex flex-col justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg truncate">{f.title}</h3>
                        <div className="text-xs sm:text-sm opacity-70">
                          {new Date(f.createdAt).toLocaleString("fr-FR")}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <a
                          className="btn btn-primary btn-sm w-full sm:w-auto"
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ouvrir
                        </a>
                        <a
                          className="btn btn-outline btn-sm w-full sm:w-auto"
                          href={f.url}
                          download
                        >
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