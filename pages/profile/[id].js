// pages/profile/[id].js
import { useEffect, useMemo, useState } from "react";
import NavBar from "../../components/NavBar";
import BadgePill from "../../components/BadgePill";
import prisma from "../../lib/prisma";

const PERIODS = [
  { id: "season", label: "Saison" },
  { id: "month",  label: "Mois" },
  { id: "week",   label: "Semaine" },
  { id: "day",    label: "Jour" },
];

export default function Profile({ user }) {
  const [period, setPeriod] = useState("season");
  const [tradeData, setTradeData] = useState(null); // { badges, perf, rank, equity }
  const [tradeLoading, setTradeLoading] = useState(false);

  // Tentatives de quiz (source unique pour l’historique et les stats quiz)
  const [attempts, setAttempts] = useState([]);
  const [quizLoading, setQuizLoading] = useState(true);
  const [errQuiz, setErrQuiz] = useState("");

  // Charge stats trading (endpoint existant /api/badges)
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setTradeLoading(true);
      try {
        const r = await fetch(`/api/badges?userId=${encodeURIComponent(user.id)}&period=${encodeURIComponent(period)}`);
        const j = await r.json();
        if (alive) setTradeData(j);
      } catch {
        if (alive) setTradeData(null);
      } finally {
        if (alive) setTradeLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, period]);

  // Charge tentatives quiz (essaie d’abord /api/profile/quiz-history, sinon fallback sur /api/quizzes/attempts/me)
  useEffect(() => {
    let alive = true;

    async function loadAttempts() {
      setQuizLoading(true);
      setErrQuiz("");

      // helper pour normaliser les entrées (quel que soit l’endpoint)
      const normalize = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(a => ({
          id: a.id,
          // scorePct peut être null/undefined -> force nombre
          scorePct: Number(a.scorePct ?? 0),
          startedAt: a.startedAt ?? a.createdAt ?? null,
          submittedAt: a.submittedAt ?? null,
          // ‘quiz’ utilisé par le tableau (titre + slug si dispo)
          quiz: a.quiz ?? { title: a.quizTitle || a.title || a.slug || "Quiz", slug: a.quiz?.slug || a.slug },
          // totals (si fournis par l’endpoint enrichi)
          total: Number.isFinite(a.total) ? Number(a.total) : undefined,
          good: Number.isFinite(a.good) ? Number(a.good) : undefined,
        }));
      };

      try {
        // 1) Endpoint enrichi (si tu l’as ajouté)
        const r1 = await fetch(`/api/profile/quiz-history?userId=${encodeURIComponent(user?.id || "")}&take=30`, { credentials: "include" });
        if (r1.ok) {
          const j1 = await r1.json();
          if (!alive) return;
          setAttempts(normalize(j1));
          return;
        }
        // 2) Fallback historique par défaut
        const r2 = await fetch("/api/quizzes/attempts/me", { credentials: "include" });
        const j2 = await r2.json();
        if (!alive) return;
        if (!r2.ok) throw new Error(j2?.error || "LOAD_FAILED");
        setAttempts(normalize(j2));
      } catch (e) {
        if (alive) setErrQuiz(e?.message || "Erreur de chargement");
        setAttempts([]);
      } finally {
        if (alive) setQuizLoading(false);
      }
    }

    loadAttempts();
    return () => { alive = false; };
  }, [user?.id]);

  // ───────────── Stats Quiz (à partir des attempts) ─────────────
  const quizStats = useMemo(() => {
    if (!attempts?.length) return { total: 0, completed: 0, avgScore: 0, bestScore: 0, last5Avg: 0, streakDays: 0 };
    const completed = attempts.filter(a => !!a.submittedAt);
    const scores = completed.map(a => Number(a.scorePct || 0));
    const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;

    const last5 = completed
      .slice()
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5)
      .map(a => Number(a.scorePct || 0));
    const last5Avg = last5.length ? Math.round(last5.reduce((s, x) => s + x, 0) / last5.length) : 0;

    // Streak naïf: nombre de jours consécutifs avec au moins 1 soumission
    const days = new Set(
      completed.map(a => new Date(a.submittedAt).toISOString().slice(0, 10))
    );
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0,0,0,0);
    while (days.has(cursor.toISOString().slice(0,10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      total: attempts.length,
      completed: completed.length,
      avgScore,
      bestScore,
      last5Avg,
      streakDays: streak
    };
  }, [attempts]);

  // ───────────── Badges unifiés (trading + quiz) ─────────────
  const unifiedBadges = useMemo(() => {
    const arr = [];
    // badges trading depuis l’API
    if (Array.isArray(tradeData?.badges)) {
      arr.push(...tradeData.badges);
    }
    // badges quiz dynamiques (exemples simples; tu peux raffiner plus tard)
    if (quizStats.bestScore >= 90) {
      arr.push({ name: "Top 10% Quiz", color: "success", description: "Score ≥ 90% sur un quiz." });
    }
    if (quizStats.streakDays >= 3) {
      arr.push({ name: "Quiz Streak", color: "primary", description: `Quizz pendant ${quizStats.streakDays} jour(s) d’affilée.` });
    }
    if ((tradeData?.rank ?? 9999) <= 10) {
      arr.push({ name: "Trader of the Week", color: "warning", description: "Top 10 classement (période sélectionnée)." });
    }
    return arr;
  }, [tradeData, quizStats]);

  // ───────────── Historique quiz (aperçu 5 derniers) ─────────────
  const lastAttempts = useMemo(() => {
    return (attempts || [])
      .slice()
      .sort((a, b) => {
        const aDate = a.submittedAt || a.startedAt || 0;
        const bDate = b.submittedAt || b.startedAt || 0;
        return new Date(bDate) - new Date(aDate);
      })
      .slice(0, 5);
  }, [attempts]);

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {user?.name || user?.email || "Profil"}
            </h1>
            <div className="opacity-60">{user?.email}</div>
          </div>

          <a
            href="/profile"
            title="Modifier le profil"
            className="btn btn-sm btn-ghost flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487a2.418 2.418 0 013.415 3.415l-9.193 9.193a2.418 2.418 0 01-1.04.616l-3.24.973a.75.75 0 01-.926-.926l.973-3.24a2.418 2.418 0 01.616-1.04l9.193-9.193z"
              />
            </svg>
            <span>Modifier</span>
          </a>
        </header>

        {/* Périodes (impacte uniquement les stats trading) */}
        <div className="mb-5 flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              className={`btn btn-sm ${period === p.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ───────────── Stats côte à côte ───────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trading Stats */}
          <Card title="📈 Statistiques trading">
            {tradeLoading ? (
              <div className="loading loading-spinner" />
            ) : !tradeData ? (
              <div className="opacity-70">Aucune donnée.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <KPI label="Equity" value={`${Number(tradeData.equity || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`} />
                <KPI label="Perf" value={`${(Number(tradeData.perf || 0) * 100).toFixed(2)} %`} />
                <KPI label="Rang" value={tradeData.rank ? `#${tradeData.rank}` : "—"} />
                <div className="col-span-2">
                  {Array.isArray(tradeData.badges) && tradeData.badges.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tradeData.badges.map((b, i) => <BadgePill key={i} badge={b} />)}
                    </div>
                  ) : (
                    <div className="opacity-60">Pas encore de badges trading.</div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Quiz Stats */}
          <Card title="🧠 Statistiques quiz">
            {quizLoading ? (
              <div className="loading loading-spinner" />
            ) : errQuiz ? (
              <div className="alert alert-error">{errQuiz}</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <KPI label="Tentatives" value={quizStats.total} />
                <KPI label="Soumises" value={quizStats.completed} />
                <KPI label="Moyenne" value={`${quizStats.avgScore}%`} />
                <KPI label="Meilleur score" value={`${quizStats.bestScore}%`} />
                <KPI label="Moy. 5 dernières" value={`${quizStats.last5Avg}%`} />
                <KPI label="Streak" value={`${quizStats.streakDays} j`} />
              </div>
            )}
          </Card>
        </section>

        {/* ───────────── Badges unifiés ───────────── */}
        <section className="mt-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-3">🎖️ Badges</h2>
          {unifiedBadges.length ? (
            <div className="flex flex-wrap gap-2">
              {unifiedBadges.map((b, i) => <BadgePill key={i} badge={b} />)}
            </div>
          ) : (
            <div className="opacity-60">Pas encore de badges.</div>
          )}
        </section>

        {/* ───────────── Historique quiz (aperçu) ───────────── */}
        <section className="mt-6 rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Historique de quiz</h2>
            <a href="/quizzes/history" className="btn btn-sm btn-outline">Voir tout</a>
          </div>
          {quizLoading ? (
            <div className="opacity-70">Chargement…</div>
          ) : errQuiz ? (
            <div className="alert alert-error">{errQuiz}</div>
          ) : !lastAttempts.length ? (
            <div className="opacity-70">Aucune tentative pour le moment.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Quiz</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {lastAttempts.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.quiz?.slug ? (
                          <a className="link" href={`/quizzes/${r.quiz.slug}`} target="_blank" rel="noreferrer">
                            {r.quiz?.title || r.quiz?.slug}
                          </a>
                        ) : (
                          r.quiz?.title || "Quiz"
                        )}
                      </td>
                      <td>{new Date(r.submittedAt || r.startedAt).toLocaleString("fr-FR")}</td>
                      <td>{Number(r.scorePct ?? 0)}%</td>
                      <td>{r.submittedAt ? "Soumis" : "En cours"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-3xl bg-base-100/60 backdrop-blur-md border border-white/10 shadow-lg p-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function KPI({ label, value }) {
  return (
    <div className="rounded-xl bg-base-200/50 border border-white/10 p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const id = ctx.params?.id || "";
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true }
  });
  if (!user) return { notFound: true };
  return { props: { user: JSON.parse(JSON.stringify(user)) } };
}