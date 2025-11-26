// pages/quizzes/index.jsx
import { useEffect, useState, useMemo } from "react";
import PageShell from "../../components/PageShell";
import Link from "next/link";

export default function QuizzesList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ statut Plus (via /api/plus/status)
  const [plusStatus, setPlusStatus] = useState("unknown");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/quizzes");
        const j = await r.json();
        setRows(Array.isArray(j) ? j : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        const status = String(j?.status || "").toLowerCase();
        setPlusStatus(status || "none");
      } catch {
        if (alive) setPlusStatus("none");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isPlus = useMemo(
    () => plusStatus === "active",
    [plusStatus]
  );

  return (
    <PageShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h1 className="text-2xl font-bold">Quizzes</h1>
          {plusStatus !== "unknown" && (
            <span
              className={
                isPlus
                  ? "badge badge-success badge-outline"
                  : "badge badge-ghost"
              }
            >
              {isPlus ? "EDB Plus actif" : "Accès standard"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="opacity-70 text-sm">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="opacity-70 text-sm">Aucun quiz disponible pour le moment.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {rows.map((q) => {
              const isPlusOnly =
                String(q.visibility || "").toUpperCase() === "PLUS";

              return (
                <div className="glass p-4 rounded-2xl" key={q.id}>
                  <div className="flex items-center justify-between mb-1 text-xs opacity-70">
                    <span>
                      {isPlusOnly ? "EDB Plus" : "Public"} • {q.difficulty}
                    </span>
                    <span>{q._count?.questions || 0} questions</span>
                  </div>
                  <h3 className="font-semibold text-lg">{q.title}</h3>

                  {q.description && (
                    <p className="mt-1 text-sm opacity-80 line-clamp-2">
                      {q.description}
                    </p>
                  )}

                  {/* Bouton d'accès */}
                  {isPlusOnly && !isPlus ? (
                    <button
                      className="btn btn-sm mt-3 btn-disabled w-full justify-center"
                      type="button"
                    >
                      🔒 Réservé aux membres EDB Plus
                    </button>
                  ) : (
                    <Link
                      href={`/quizzes/${q.slug}`}
                      className="btn btn-primary btn-sm mt-3 w-full justify-center"
                    >
                      Jouer
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </PageShell>
  );
}