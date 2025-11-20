// pages/plus/daily.jsx
import { useEffect, useState, useMemo } from "react";
import PageShell from "../../components/PageShell";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

// Petit helper couleur
function pctClass(v) {
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-gray-200";
}

function SectionCard({ title, children }) {
  return (
    <section className="rounded-3xl glass p-5 md:p-6 mb-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function DailyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/plus/daily");
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || "LOAD_FAILED");
        setData(j);
      } catch (e) {
        if (alive) setErr(e?.message || "Erreur de chargement");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fxChartData = useMemo(() => {
    if (!data?.markets?.forex) return [];
    return data.markets.forex.map((f) => ({
      name: f.pair,
      change: f.change_pct,
    }));
  }, [data]);

  if (loading) {
    return (
      <PageShell>
        <div className="rounded-3xl glass p-6 md:p-8 text-center">
          Chargement du daily macro…
        </div>
      </PageShell>
    );
  }

  if (err) {
    return (
      <PageShell>
        <div className="rounded-3xl glass p-6 md:p-8">
          <div className="alert alert-error">{err}</div>
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <div className="rounded-3xl glass p-6 md:p-8">
          Impossible de charger les données.
        </div>
      </PageShell>
    );
  }

  const d = data;

  return (
    <PageShell>
      {/* HERO */}
      <section className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Daily Global Macro
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Rapport quotidien — {d.date}
        </h1>
        <p className="mt-3 md:text-lg opacity-90">{d.summary}</p>
      </section>

      {/* TOP : Marchés (FX + indices + crypto) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Devises majeures (vs USD)">
          {!d.markets?.forex?.length ? (
            <div className="opacity-60 text-sm">
              Pas de données FX (API FX indisponible).
            </div>
          ) : (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="table table-compact text-sm">
                  <thead>
                    <tr>
                      <th>Paire</th>
                      <th>Cours</th>
                      <th>Variation J-1</th>
                      <th>Tendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.markets.forex.map((f) => (
                      <tr key={f.pair}>
                        <td>{f.pair}</td>
                        <td>{f.value}</td>
                        <td className={pctClass(f.change_pct)}>
                          {f.change_pct > 0 ? "+" : ""}
                          {f.change_pct}%
                        </td>
                        <td className="opacity-80 text-xs">{f.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {fxChartData.length > 0 && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fxChartData}>
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip
                        formatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
                      />
                      <Bar dataKey="change" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard title="Indices & Crypto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="text-xs uppercase opacity-70 mb-1">Indices</h3>
              {!d.markets?.indices?.length ? (
                <div className="opacity-60">Pas de données indices.</div>
              ) : (
                <ul className="space-y-1">
                  {d.markets.indices.map((idx) => (
                    <li
                      key={idx.symbol}
                      className="flex justify-between border-b border-white/10 pb-1"
                    >
                      <div>
                        <div className="font-medium">{idx.name}</div>
                        <div className="text-xs opacity-70">
                          {idx.symbol} · {idx.value}
                        </div>
                      </div>
                      <div className={`text-right ${pctClass(idx.change_pct)}`}>
                        {idx.change_pct > 0 ? "+" : ""}
                        {idx.change_pct}%
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs uppercase opacity-70 mb-1">Crypto</h3>
              {!d.markets?.crypto?.length ? (
                <div className="opacity-60">Pas de données crypto.</div>
              ) : (
                <ul className="space-y-1">
                  {d.markets.crypto.map((c) => (
                    <li
                      key={c.symbol}
                      className="flex justify-between border-b border-white/10 pb-1"
                    >
                      <div>
                        <div className="font-medium">
                          {c.asset} ({c.symbol})
                        </div>
                        <div className="text-xs opacity-70">
                          {c.value} USD
                        </div>
                      </div>
                      <div className={`text-right ${pctClass(c.change_pct)}`}>
                        {c.change_pct > 0 ? "+" : ""}
                        {c.change_pct}%
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* TOP MOVERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Top Gainers">
          {!d.top_movers?.top_gainers?.length ? (
            <div className="opacity-60 text-sm">Rien de particulier.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.top_movers.top_gainers.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <div>
                    <div className="font-medium">
                      {s.ticker} {s.name ? `• ${s.name}` : ""}
                    </div>
                    {s.reason && (
                      <div className="text-xs opacity-70">{s.reason}</div>
                    )}
                  </div>
                  <div className={pctClass(s.change_pct)}>
                    {s.change_pct > 0 ? "+" : ""}
                    {s.change_pct}%
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Top Losers">
          {!d.top_movers?.top_losers?.length ? (
            <div className="opacity-60 text-sm">Rien de particulier.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.top_movers.top_losers.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <div>
                    <div className="font-medium">
                      {s.ticker} {s.name ? `• ${s.name}` : ""}
                    </div>
                    {s.reason && (
                      <div className="text-xs opacity-70">{s.reason}</div>
                    )}
                  </div>
                  <div className={pctClass(s.change_pct)}>
                    {s.change_pct > 0 ? "+" : ""}
                    {s.change_pct}%
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* MACRO + GÉO + CORPORATE + AGENDA */}
      <SectionCard title="Macro & banques centrales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="text-xs uppercase opacity-70 mb-1">Croissance</h3>
            <ul className="space-y-1">
              {(d.macro?.growth || []).map((g, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {g.region} — {g.indicator} : {g.value}
                  </span>
                  {g.comment && (
                    <span className="opacity-80"> · {g.comment}</span>
                  )}
                </li>
              ))}
            </ul>

            <h3 className="text-xs uppercase opacity-70 mb-1 mt-3">
              Inflation
            </h3>
            <ul className="space-y-1">
              {(d.macro?.inflation || []).map((g, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {g.region} — {g.indicator} : {g.value}
                  </span>
                  {g.comment && (
                    <span className="opacity-80"> · {g.comment}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase opacity-70 mb-1">Emploi</h3>
            <ul className="space-y-1">
              {(d.macro?.employment || []).map((g, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {g.region} — {g.indicator} : {g.value}
                  </span>
                  {g.comment && (
                    <span className="opacity-80"> · {g.comment}</span>
                  )}
                </li>
              ))}
            </ul>

            <h3 className="text-xs uppercase opacity-70 mb-1 mt-3">
              Banques centrales
            </h3>
            <ul className="space-y-1">
              {(d.macro?.central_banks || []).map((g, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {g.institution} — {g.stance}
                  </span>
                  {g.comment && (
                    <span className="opacity-80"> · {g.comment}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Géopolitique">
          <ul className="space-y-1 text-sm">
            {(d.geopolitics || []).map((g, i) => (
              <li key={i}>
                <span className="font-medium">{g.region} : </span>
                <span>{g.event}</span>
                {g.impact && (
                  <span className="opacity-80"> · Impact : {g.impact}</span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Corporate / Résultats">
          <ul className="space-y-1 text-sm">
            {(d.corporate || []).map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.company} : </span>
                <span>{c.news}</span>
                {c.impact && (
                  <span className={pctClass(
                    parseFloat(String(c.impact).replace("%","")) || 0
                  )}>
                    {" "}
                    ({c.impact})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Agenda & sentiment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="text-xs uppercase opacity-70 mb-1">Agenda du jour</h3>
            <ul className="list-disc list-inside space-y-1">
              {(d.agenda?.today || []).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>

            <h3 className="text-xs uppercase opacity-70 mb-1 mt-3">
              Semaine à venir
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {(d.agenda?.week_ahead || []).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase opacity-70 mb-1">Sentiment</h3>
            <div className="rounded-2xl bg-base-100/40 border border-white/10 p-3">
              <div>Fear & Greed Index : {d.sentiment?.fear_greed}</div>
              <div>VIX : {d.sentiment?.vix}</div>
              <div className="mt-2 opacity-80">{d.sentiment?.comment}</div>
            </div>

            {d.ai_commentary && (
              <div className="mt-3 rounded-2xl bg-base-100/40 border border-white/10 p-3 text-sm">
                <div className="text-xs uppercase opacity-70 mb-1">
                  Commentaire IA
                </div>
                <p className="opacity-90">{d.ai_commentary}</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}

// 🔐 Gate Plus / Admin
export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const u = session?.user || {};
  const isPlus =
    u.isPlusActive === true || u.plusStatus === "active" || u.role === "ADMIN";

  if (!isPlus) {
    return {
      redirect: {
        destination: "/login?next=/plus/daily",
        permanent: false,
      },
    };
  }

  return { props: {} };
}