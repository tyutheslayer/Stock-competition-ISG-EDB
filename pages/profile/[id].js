// pages/profile/[id].js
import { useEffect, useState } from "react";
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
  const [data, setData] = useState(null); // { badges, perf, rank, equity }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/badges?userId=${encodeURIComponent(user.id)}&period=${encodeURIComponent(period)}`);
        const j = await r.json();
        if (alive) setData(j);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, period]);

  return (
    <div>
      <NavBar />
      <main className="page max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">{user?.name || user?.email || "Profil"}</h1>
        <div className="opacity-60 mb-4">{user?.email}</div>

        <div className="mb-4 flex flex-wrap gap-2">
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

        <div className="rounded-2xl shadow bg-base-100 p-4">
          {loading ? (
            <div className="loading loading-spinner" />
          ) : !data ? (
            <div className="opacity-70">Aucune donnée.</div>
          ) : (
            <>
              <div className="mb-3 text-sm opacity-70">
                Equity: <b>{Number(data.equity || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</b>
                {" · "}Perf: <b>{(Number(data.perf || 0) * 100).toFixed(2)}%</b>
                {data.rank ? <>{" · "}Rang: <b>#{data.rank}</b></> : null}
              </div>
              {Array.isArray(data.badges) && data.badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.badges.map((b, i) => <BadgePill key={i} badge={b} />)}
                </div>
              ) : (
                <div className="opacity-60">Pas encore de badges sur cette période.</div>
              )}
            </>
          )}
        </div>
      </main>
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