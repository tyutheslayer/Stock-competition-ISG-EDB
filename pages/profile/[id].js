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

  // Charge tentatives quiz (endpoint qu’on a déjà)
  useEffect(() => {
    let alive = true;
    (async () => {
      setQuizLoading(true);
      setErrQuiz("");
      try {
        const r = await fetch("/api/quizzes/attempts/me", { credentials: "include" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || "LOAD_FAILED");
        setAttempts(Array.isArray(j) ? j : []);
      } catch (e) {
        if (alive) setErrQuiz(e?.message || "Erreur de chargement");
      } finally {
        if (alive) setQuizLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ───────────── Stats Quiz (à partir des attempts) ─────────────
  const quizStats = useMemo(() => {
    if (!attempts?.length) return { total: 0, completed: 0, avgScore: 0, bestScore: 0, last5Avg: 0, streakDays: 0 };
    const completed = attempts.filter(a => !!a.submittedAt);
    const scores = completed.map(a => Number(a.scorePct || 0));
    const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;

    const last5 = completed
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
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, 5);
  }, [attempts]);

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <header className="mb-4">
          <h1 className="text-3xl font-bold">{user?.name || user?.email || "Profil"}</h1>
          <div className="opacity-60">{user?.email}</div>
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
                      <td>{r.quiz?.title || r.quiz?.slug}</td>
                      <td>{new Date(r.startedAt).toLocaleString("fr-FR")}</td>
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