// pages/plus/insights/index.jsx
import PageShell from "../../../components/PageShell";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import LineChartInsight from "../../../components/insights/LineChartInsight";

function SectionList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold opacity-80 mb-1">{title}</h3>
      <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
        {items.map((it, idx) => (
          <li key={idx}>
            {it.title && <span className="font-medium">{it.title} : </span>}
            <span>{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Headlines({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl bg-base-100/40 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
        Actualités entreprises
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((h, i) => (
          <li key={i}>
            <span className="font-semibold">
              {h.company}
              {h.region ? ` (${h.region})` : ""} —{" "}
            </span>
            <span>{h.headline}</span>
            {h.impact && (
              <span className="opacity-80"> — Impact : {h.impact}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsightCard({ it }) {
  const date = it.weekStart
    ? new Date(it.weekStart).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date(it.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const hasStructured =
    it.macro.length ||
    it.markets.length ||
    it.sectors.length ||
    it.headlines.length ||
    it.focus;

  const plainPreview =
    (it.plainContent || "")
      .replace(/\s+/g, " ")
      .slice(0, 380) +
    (it.plainContent && it.plainContent.length > 380 ? "…" : "");

  return (
    <article className="rounded-3xl glass p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">{it.title}</h2>
        <div className="text-xs opacity-70">Semaine du {date}</div>
      </div>

      {it.summary && (
        <p className="text-sm md:text-base opacity-90 mb-3 whitespace-pre-line">
          {it.summary}
        </p>
      )}

      {hasStructured ? (
        <>
          <SectionList title="Macro" items={it.macro} />
          <SectionList title="Marchés" items={it.markets} />
          <SectionList title="Secteurs / Thèmes" items={it.sectors} />
          <Headlines items={it.headlines} />

          {/* Charts */}
          {(it.equityChart.length ||
            it.ratesFxChart.length ||
            it.volChart.length) && (
            <div className="grid md:grid-cols-3 gap-4 mt-5">
              <LineChartInsight
                title="Indices actions (% sur la semaine)"
                data={it.equityChart}
                dataKey="changePct"
                unit="%"
              />
              <LineChartInsight
                title="Taux / FX (variation)"
                data={it.ratesFxChart}
                dataKey="change"
                unit=""
              />
              <LineChartInsight
                title="Volatilité (niveau)"
                data={it.volChart}
                dataKey="level"
              />
            </div>
          )}

          {it.focus && (
            <div className="mt-4 rounded-2xl bg-base-100/40 border border-white/10 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
                Focus EDB Plus
              </div>
              <p className="opacity-90 whitespace-pre-line">{it.focus}</p>
            </div>
          )}
        </>
      ) : (
        plainPreview && (
          <p className="text-sm opacity-80 whitespace-pre-line">
            {plainPreview}
          </p>
        )
      )}
    </article>
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
          Briefings réservés aux membres EDB Plus, pour capter l’essentiel de la
          semaine en quelques minutes. Macro, marchés, news entreprises et mini
          dashboards.
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
            <InsightCard key={it.id} it={it} />
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
    orderBy: { weekStart: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      weekStart: true,
      createdAt: true,
      slug: true,
    },
  });

  const insights = rows.map((r) => {
    let macro = [];
    let markets = [];
    let sectors = [];
    let headlines = [];
    let equityChart = [];
    let ratesFxChart = [];
    let volChart = [];
    let focus = "";
    let plainContent = r.content || "";

    if (r.content) {
      try {
        const obj = JSON.parse(r.content);
        if (obj && typeof obj === "object") {
          if (Array.isArray(obj.macro)) macro = obj.macro;
          if (Array.isArray(obj.markets)) markets = obj.markets;
          if (Array.isArray(obj.sectors)) sectors = obj.sectors;
          if (Array.isArray(obj.headlines)) headlines = obj.headlines;
          if (Array.isArray(obj.equityChart)) equityChart = obj.equityChart;
          if (Array.isArray(obj.ratesFxChart)) ratesFxChart = obj.ratesFxChart;
          if (Array.isArray(obj.volChart)) volChart = obj.volChart;
          if (typeof obj.focus === "string") focus = obj.focus;

          if (
            macro.length ||
            markets.length ||
            sectors.length ||
            headlines.length ||
            equityChart.length ||
            ratesFxChart.length ||
            volChart.length ||
            focus
          ) {
            plainContent = "";
          }
        }
      } catch {
        // ancien format texte -> plainContent reste
      }
    }

    return {
      id: r.id,
      title: r.title,
      summary: r.summary || "",
      weekStart: r.weekStart ? r.weekStart.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      slug: r.slug,
      macro,
      markets,
      sectors,
      headlines,
      equityChart,
      ratesFxChart,
      volChart,
      focus,
      plainContent,
    };
  });

  return { props: { insights } };
}