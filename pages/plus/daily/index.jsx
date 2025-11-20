// pages/plus/daily/index.jsx
import { useEffect, useState } from "react";
import PageShell from "../../../components/PageShell";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";

export default function DailyPage({ initialDaily, isAdmin }) {
  const [daily, setDaily] = useState(initialDaily);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // bouton admin "Regénérer pour aujourd'hui" si tu veux forcer
  async function regenerate() {
    setMsg("");
    setLoading(true);
    try {
      const r = await fetch("/api/plus/daily/generate", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "FAILED");
      setDaily(j.daily);
      setMsg(j.fromCache ? "Daily déjà généré pour aujourd’hui." : "Nouveau daily généré ✅");
    } catch (e) {
      setMsg(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const payload = daily?.payload || null;

  return (
    <PageShell>
      <section className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Daily Macro & Markets
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Rapport quotidien EDB Plus
        </h1>
        {payload?.date && (
          <div className="mt-2 text-sm opacity-70">
            Rapport pour la séance du <b>{payload.date}</b>
          </div>
        )}
        {isAdmin && (
          <div className="mt-4 flex gap-2">
            <button
              className={`btn btn-primary btn-sm ${loading ? "btn-disabled" : ""}`}
              onClick={regenerate}
            >
              {loading ? "Génération…" : "Regénérer pour aujourd’hui"}
            </button>
            {msg && <span className="text-xs opacity-80">{msg}</span>}
          </div>
        )}
      </section>

      {!payload ? (
        <div className="rounded-3xl glass p-6">
          <p className="opacity-70">
            Aucun daily généré pour aujourd’hui. Un admin peut en créer un depuis ce même écran.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <section className="rounded-3xl glass p-5">
            <h2 className="text-xl font-semibold mb-2">Synthèse</h2>
            <p className="opacity-90">{payload.summary}</p>
          </section>

          {/* Marchés, macro, etc. → tu pourras brancher Recharts ici plus tard */}
          {/* Ex: listes indices, forex, top_movers... */}
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
        destination: "/login?next=/plus/daily",
        permanent: false,
      },
    };
  }

  const { default: prisma } = await import("../../../lib/prisma");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const daily = await prisma.dailyInsight.findUnique({
    where: { day: today },
  });

  const initialDaily = daily
    ? { ...daily, day: daily.day.toISOString() }
    : null;

  return {
    props: {
      initialDaily,
      isAdmin,
    },
  };
}