// pages/quizzes/history.jsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import PageShell from "../../components/PageShell";

export default function QuizHistoryPage() {
  const { status } = useSession();
  const [attempts, setAttempts] = useState([]);
  const [loadingMe, setLoadingMe] = useState(true);
  const [msgMe, setMsgMe] = useState("");

  const [quizList, setQuizList] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [board, setBoard] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [msgBoard, setMsgBoard] = useState("");

  // Mes tentatives
  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    setLoadingMe(true);
    setMsgMe("");
    (async () => {
      try {
        const r = await fetch("/api/quizzes/attempts/me", { credentials: "include" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || "LOAD_ME_FAILED");
        setAttempts(Array.isArray(j) ? j : []);
      } catch (e) {
        setMsgMe(e.message || "Erreur de chargement");
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => { alive = false; };
  }, [status]);

  // Liste des quiz pour le sélecteur + précharge premier
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/quizzes/leaderboard");
        const j = await r.json();
        if (!alive) return;
        const list = j?.quizzes || [];
        setQuizList(list);
        if (list.length && !selectedSlug) setSelectedSlug(list[0].slug);
      } catch {
        // noop
      }
    })();
    return () => { alive = false; };
  }, []);

  // Charger le classement du quiz sélectionné
  useEffect(() => {
    if (!selectedSlug) { setBoard([]); return; }
    let alive = true;
    setLoadingBoard(true);
    setMsgBoard("");
    (async () => {
      try {
        const r = await fetch(`/api/quizzes/leaderboard?slug=${encodeURIComponent(selectedSlug)}&limit=50`);
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || "LOAD_BOARD_FAILED");
        setBoard(Array.isArray(j?.leaderboard) ? j.leaderboard : []);
      } catch (e) {
        setMsgBoard(e.message || "Erreur classement");
      } finally {
        if (alive) setLoadingBoard(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedSlug]);

  const grouped = useMemo(() => {
    // group by quiz.slug
    const by = new Map();
    for (const a of attempts) {
      const slug = a?.quiz?.slug || "unknown";
      if (!by.has(slug)) by.set(slug, []);
      by.get(slug).push(a);
    }
    for (const [, arr] of by) {
      arr.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    }
    return Array.from(by.entries());
  }, [attempts]);

  const needLogin = status !== "authenticated";

  return (
    <PageShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        <h1 className="text-3xl font-bold mb-2">Historique de quiz</h1>
        <p className="opacity-70 mb-6">
          Tes tentatives personnelles (à gauche) et un classement dédié aux quiz (à droite).  
          Le classement est séparé du tableau de classement trading.
        </p>

        {needLogin ? (
          <div className="alert alert-info">Connecte-toi pour voir ton historique.</div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Colonne gauche : mon historique */}
            <section className="col-span-12 lg:col-span-7">
              <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-5">
                <h2 className="text-xl font-semibold mb-3">Mes tentatives</h2>
                {loadingMe ? (
                  <div className="opacity-70">Chargement…</div>
                ) : msgMe ? (
                  <div className="alert alert-error">{msgMe}</div>
                ) : attempts.length === 0 ? (
                  <div className="opacity-70">Aucune tentative pour le moment.</div>
                ) : (
                  grouped.map(([slug, rows]) => (
                    <div key={slug} className="mb-5">
                      <div className="font-semibold mb-2">
                        {rows[0]?.quiz?.title || slug} <span className="opacity-60">({slug})</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table table-zebra">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Score</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>{new Date(r.startedAt).toLocaleString("fr-FR")}</td>
                                <td>{Number(r.scorePct ?? 0)}%</td>
                                <td>{r.submittedAt ? "Soumis" : "En cours"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Colonne droite : classement par quiz */}
            <aside className="col-span-12 lg:col-span-5">
              <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-5">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <h2 className="text-xl font-semibold">Classement quiz</h2>
                  <select
                    className="select select-bordered select-sm"
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                  >
                    {quizList.map((q) => (
                      <option key={q.slug} value={q.slug}>{q.title}</option>
                    ))}
                  </select>
                </div>

                {loadingBoard ? (
                  <div className="opacity-70">Chargement du classement…</div>
                ) : msgBoard ? (
                  <div className="alert alert-error">{msgBoard}</div>
                ) : board.length === 0 ? (
                  <div className="opacity-70">Aucune soumission pour ce quiz.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-compact">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nom</th>
                          <th>Score</th>
                          <th>Soumis le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.map((row) => (
                          <tr key={`${row.rank}-${row.user?.email || row.user?.name}`}>
                            <td>{row.rank}</td>
                            <td>{row.user?.name}</td>
                            <td>{row.scorePct}%</td>
                            <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString("fr-FR") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </PageShell>
  );
}