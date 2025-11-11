// pages/plus/index.jsx
import PageShell from "../../components/PageShell";
import prisma from "../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]";

function KPI({ label, value, hint }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint ? <div className="text-xs opacity-70 mt-1">{hint}</div> : null}
    </div>
  );
}

export default function PlusHome({ me, kpis, highlights }) {
  return (
    <PageShell>
      {/* HERO / header exclusif */}
      <section className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Exclusive members area
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Bienvenue dans EDB <span className="text-primary">Plus</span>
        </h1>
        <p className="mt-3 md:text-lg opacity-90">
          « Investir, c’est plus que des chiffres — c’est une discipline. »
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/plus/sheets" className="btn btn-primary">📚 Ressources privées</a>
          <a href="/quizzes" className="btn btn-outline">🧠 Quiz Plus</a>
          <a href="/leaderboard" className="btn btn-outline">🏆 Classement</a>
          <a href="/portfolio" className="btn btn-outline">💼 Mon portefeuille</a>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPI label="Quiz disponibles" value={kpis.quizzesPlus} hint="Visibilité PLUS, publiés" />
        <KPI label="Fiches privées" value={kpis.sheets} hint="PDF dans l’espace Plus" />
        <KPI label="Mon score moyen" value={`${kpis.avgScore}%`} hint="sur mes quiz soumis" />
      </section>

      {/* À la une */}
      <section className="rounded-3xl glass p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">À la une</h2>
          <div className="flex gap-2">
            <a className="btn btn-sm btn-outline" href="/plus/sheets">Toutes les fiches</a>
            <a className="btn btn-sm btn-outline" href="/quizzes">Tous les quiz</a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-base-100/40 border border-white/10 p-4">
            <div className="text-sm opacity-70 mb-1">Derniers quiz (PLUS)</div>
            {highlights.quizzes.length === 0 ? (
              <div className="opacity-60">Rien pour l’instant.</div>
            ) : (
              <ul className="space-y-2">
                {highlights.quizzes.map(q => (
                  <li key={q.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs opacity-60">
                        {q.difficulty} • {new Date(q.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <a className="btn btn-sm btn-primary" href={`/quizzes/${q.slug}`}>Ouvrir</a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-base-100/40 border border-white/10 p-4">
            <div className="text-sm opacity-70 mb-1">Dernières fiches</div>
            {highlights.sheets.length === 0 ? (
              <div className="opacity-60">Rien pour l’instant.</div>
            ) : (
              <ul className="space-y-2">
                {highlights.sheets.map(s => (
                  <li key={s.id || s.key} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.title || s.name || "Sans titre"}</div>
                      <div className="text-xs opacity-60">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : "—"}
                      </div>
                    </div>
                    <a className="btn btn-sm btn-primary" href={s.url} target="_blank" rel="noreferrer">Ouvrir</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // Gate: Plus OU Admin requis
  const role = session?.user?.role || null;
  const isPlus = session?.user?.isPlusActive === true || session?.user?.plusStatus === "active";
  const isAdmin = role === "ADMIN";
  if (!isPlus && !isAdmin) {
    return {
      redirect: { destination: "/login?next=/plus", permanent: false },
    };
  }

  const me = session?.user || null;

  // KPIs
  const [quizzesPlus, sheetsCount, myAttempts] = await Promise.all([
    prisma.quiz.count({ where: { visibility: "PLUS", isDraft: false } }),
    // si tu stockes les sheets en DB :
    prisma.plusSheet?.count ? prisma.plusSheet.count() : Promise.resolve(0),
    prisma.quizAttempt.findMany({
      where: { userId: me?.id || "" , submittedAt: { not: null } },
      select: { scorePct: true },
    }),
  ]);

  const scores = myAttempts.map(a => Number(a.scorePct || 0)).filter(n => Number.isFinite(n));
  const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;

  // À la une
  const latestQuizzes = await prisma.quiz.findMany({
    where: { visibility: "PLUS", isDraft: false },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, slug: true, title: true, difficulty: true, createdAt: true },
  });

  // si tu n’as pas de table DB pour les fiches, récupère via ton endpoint blob
  let latestSheets = [];
  try {
    // si tu as un endpoint interne /api/plus/sheets (déjà utilisé dans ton admin)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (baseUrl) {
      const r = await fetch(`${baseUrl}/api/plus/sheets`);
      latestSheets = (await r.json()).slice(0, 3);
    }
  } catch {}

  return {
    props: {
      me: { id: me?.id || null, email: me?.email || null },
      kpis: {
        quizzesPlus,
        sheets: sheetsCount,
        avgScore,
      },
      highlights: {
        quizzes: latestQuizzes.map(q => ({ ...q, createdAt: q.createdAt.toISOString() })),
        sheets: latestSheets,
      },
    },
  };
}