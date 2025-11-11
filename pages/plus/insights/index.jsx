// pages/plus/insights/index.jsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import PageShell from "../../../components/PageShell";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// recharts en dynamic import pour éviter SSR mismatch
const LineChartComp = dynamic(() => import("../../../components/insights/LineChartInsight"), { ssr: false });

function InsightCard({ item }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{item.title}</h3>
        <div className="text-xs opacity-70">{item.week}</div>
      </div>
      {item.kind === "chart" && item.dataset === "line" ? (
        <>
          {item.note && <div className="text-sm opacity-80 mb-2">{item.note}</div>}
          <LineChartComp data={item.data || []} />
        </>
      ) : item.kind === "article" ? (
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: item.html || "" }}
        />
      ) : (
        <div className="opacity-60 text-sm">Format non supporté.</div>
      )}
    </div>
  );
}

export default function PlusInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/plus/insights");
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || "LOAD_FAILED");
        setInsights(Array.isArray(j) ? j : []);
      } catch (e) {
        if (alive) setErr(e?.message || "Erreur de chargement");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <PageShell>
      <div className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">Weekly Insights</div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">Analyses réservées aux membres Plus</h1>
        <p className="mt-2 opacity-90">
          Graphiques exclusifs et notes hebdomadaires pour t’aider à structurer ta lecture de marché.
        </p>
      </div>

      {loading ? (
        <div>Chargement…</div>
      ) : err ? (
        <div className="alert alert-error">{err}</div>
      ) : insights.length === 0 ? (
        <div className="opacity-70">Aucun insight pour le moment.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {insights.map((it) => <InsightCard key={it.id} item={it} />)}
        </div>
      )}
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const role = session?.user?.role || null;
  const isPlus =
    session?.user?.isPlusActive === true ||
    session?.user?.plusStatus === "active";
  const isAdmin = role === "ADMIN";

  if (!isPlus && !isAdmin) {
    return { redirect: { destination: "/login?next=/plus/insights", permanent: false } };
  }
  return { props: {} };
}