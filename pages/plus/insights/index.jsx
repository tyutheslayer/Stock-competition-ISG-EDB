// pages/plus/insights/index.jsx
import PageShell from "../../../components/PageShell";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";

function Section({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold opacity-80 mb-1">{title}</h3>
      <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
        {items.map((it, idx) => (
          <li key={idx}>
            <span className="font-medium">{it.title} : </span>
            <span>{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InsightsPage({ insights }) {
  return (
    <PageShell>
      <section className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Weekly Insights
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Synthèses macro & marchés
        </h1>
        <p className="mt-3 md:text-lg opacity-90">
          Briefings réservés aux membres EDB Plus, pour capter l’essentiel de la semaine
          en quelques minutes.
        </p>
      </section>

      {insights.length === 0 ? (
        <div className="rounded-3xl glass p-6 md:p-8">
          <p className="opacity-70">
            Aucun insight pour le moment. Un premier sera généré dès que tu
            utiliseras l’endpoint&nbsp;: <code>/api/plus/insights/generate</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {insights.map((it) => (
            <article key={it.id} className="rounded-3xl glass p-5 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h2 className="text-xl font-semibold">{it.title}</h2>
                <div className="text-xs opacity-70">
                  Semaine du{" "}
                  {new Date(it.weekOf).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <p className="text-sm md:text-base opacity-90 mb-3 whitespace-pre-line">
                {it.summary}
              </p>

              <Section title="Macro" items={it.macro} />
              <Section title="Marchés" items={it.markets} />
              <Section title="Secteurs / Thèmes" items={it.sectors} />

              {it.focus && (
                <div className="mt-4 rounded-2xl bg-base-100/40 border border-white/10 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
                    Focus EDB Plus
                  </div>
                  <p className="opacity-90 whitespace-pre-line">{it.focus}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const u = session?.user || {};
  const isPlus = u.isPlusActive === true || u.plusStatus === "active";
  const isAdmin = u.role === "ADMIN";

  if (!isPlus && !isAdmin) {
    return {
      redirect: {
        destination: "/login?next=/plus/insights",
        permanent: false,
      },
    };
  }

  const rows = await prisma.weeklyInsight.findMany({
    orderBy: { weekOf: "desc" },
    take: 8,
  });

  const insights = rows.map((r) => ({
    id: r.id,
    weekOf: r.weekOf.toISOString(),
    title: r.title,
    summary: r.summary,
    focus: r.focus,
    macro: Array.isArray(r.macroJson) ? r.macroJson : [],
    markets: Array.isArray(r.marketsJson) ? r.marketsJson : [],
    sectors: Array.isArray(r.sectorsJson) ? r.sectorsJson : [],
  }));

  return { props: { insights } };
}