// pages/plus/daily/index.jsx
import { useState } from "react";
import PageShell from "../../../components/PageShell";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import prisma from "../../../lib/prisma";

function Pill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-base-100/40 border border-white/10">
      <span className="opacity-70">{label} :</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="rounded-3xl glass p-4 md:p-5 mb-4">
      <h2 className="text-sm md:text-base font-semibold mb-2 opacity-80">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DailyPage({ isAdmin, initialReport }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(initialReport || null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/plus/daily/generate?force=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || j?.detail || "Erreur API");
      }

      // L’API peut renvoyer soit { report }, soit { daily: { payload } }
      const nextReport =
        j.report ||
        j.daily?.payload || // structure actuelle
        j.daily?.report ||  // fallback si tu changes plus tard
        null;

      setReport(nextReport);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const markets = report?.markets || {};
  const macro = report?.macro || {};
  const topMovers = report?.top_movers || {};

  return (
    <PageShell>
      {/* HERO */}
      <section className="rounded-3xl glass p-6 md:p-8 mb-6">
        <div className="text-xs tracking-widest opacity-80 uppercase">
          Daily Macro
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-1">
          Rapport quotidien marchés & macro
        </h1>
        <p className="mt-3 md:text-lg opacity-90">
          Vue d’ensemble des marchés, devises, matières premières et thèmes macro,
          pensée pour les membres EDB Plus.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {report?.date && <Pill label="Date" value={report.date} />}
          {report?.sentiment?.vix != null && (
            <Pill label="VIX" value={report.sentiment.vix} />
          )}
          {report?.sentiment?.fear_greed != null && (
            <Pill label="Fear & Greed" value={report.sentiment.fear_greed} />
          )}
        </div>

        {isAdmin && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className={`btn btn-primary btn-sm ${loading ? "btn-disabled" : ""}`}
              onClick={handleGenerate}
            >
              {loading ? "Génération en cours…" : "Générer / rafraîchir le daily (admin)"}
            </button>
            {error && (
              <span className="text-xs text-red-300 whitespace-pre-line">
                {error}
              </span>
            )}
          </div>
        )}
      </section>

      {!report ? (
        <section className="rounded-3xl glass p-6 md:p-8">
          <p className="opacity-75 text-sm">
            Aucun rapport chargé pour l’instant.
            {isAdmin
              ? " Clique sur le bouton ci-dessus pour générer le daily du jour (pour J-1)."
              : " Un admin doit d’abord générer le rapport."}
          </p>
        </section>
      ) : (
        <>
          {/* SYNTHÈSE */}
          <Section title="Synthèse">
            <p className="text-sm md:text-base opacity-90 whitespace-pre-line">
              {report.summary}
            </p>
            {report.ai_commentary && (
              <p className="mt-2 text-xs md:text-sm opacity-80 italic">
                {report.ai_commentary}
              </p>
            )}
          </Section>

          {/* MARCHÉS */}
          <Section title="Marchés — Indices, FX, matières, crypto, taux">
            <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm">
              {/* Indices */}
              {Array.isArray(markets.indices) && markets.indices.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1 opacity-80">Indices</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-compact text-xs">
                      <thead>
                        <tr>
                          <th>Indice</th>
                          <th>Niveau</th>
                          <th>Perf J-1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.indices.map((idx, i) => (
                          <tr key={i}>
                            <td>{idx.name}</td>
                            <td>{idx.value}</td>
                            <td
                              className={
                                idx.change_pct > 0
                                  ? "text-green-400"
                                  : idx.change_pct < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {idx.change_pct > 0 ? "+" : ""}
                              {idx.change_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* FX */}
              {Array.isArray(markets.forex) && markets.forex.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1 opacity-80">Forex</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-compact text-xs">
                      <thead>
                        <tr>
                          <th>Pair</th>
                          <th>Cours</th>
                          <th>Perf J-1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.forex.map((fx, i) => (
                          <tr key={i}>
                            <td>{fx.pair}</td>
                            <td>{fx.value}</td>
                            <td
                              className={
                                fx.change_pct > 0
                                  ? "text-green-400"
                                  : fx.change_pct < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {fx.change_pct > 0 ? "+" : ""}
                              {fx.change_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Commodities */}
              {Array.isArray(markets.commodities) &&
                markets.commodities.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">
                      Matières premières
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="table table-compact text-xs">
                        <thead>
                          <tr>
                            <th>Actif</th>
                            <th>Niveau</th>
                            <th>Perf J-1</th>
                          </tr>
                        </thead>
                        <tbody>
                          {markets.commodities.map((c, i) => (
                            <tr key={i}>
                              <td>{c.asset}</td>
                              <td>
                                {c.value}
                                {c.unit ? ` ${c.unit}` : ""}
                              </td>
                              <td
                                className={
                                  c.change_pct > 0
                                    ? "text-green-400"
                                    : c.change_pct < 0
                                    ? "text-red-400"
                                    : ""
                                }
                              >
                                {c.change_pct > 0 ? "+" : ""}
                                {c.change_pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Crypto */}
              {Array.isArray(markets.crypto) && markets.crypto.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1 opacity-80">Crypto</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-compact text-xs">
                      <thead>
                        <tr>
                          <th>Actif</th>
                          <th>Prix</th>
                          <th>Perf J-1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.crypto.map((c, i) => (
                          <tr key={i}>
                            <td>{c.asset}</td>
                            <td>{c.value}</td>
                            <td
                              className={
                                c.change_pct > 0
                                  ? "text-green-400"
                                  : c.change_pct < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {c.change_pct > 0 ? "+" : ""}
                              {c.change_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bonds */}
              {Array.isArray(markets.bonds) && markets.bonds.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="font-semibold mb-1 opacity-80">Taux / Obligations</h3>
                  <div className="overflow-x-auto">
                    <table className="table table-compact text-xs">
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Rendement</th>
                          <th>Δ (bps)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets.bonds.map((b, i) => (
                          <tr key={i}>
                            <td>{b.country}</td>
                            <td>{b.yield}%</td>
                            <td
                              className={
                                b.change_bps > 0
                                  ? "text-red-400"
                                  : b.change_bps < 0
                                  ? "text-green-400"
                                  : ""
                              }
                            >
                              {b.change_bps > 0 ? "+" : ""}
                              {b.change_bps}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* TOP MOVERS */}
          <Section title="Top movers actions">
            <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm">
              {Array.isArray(topMovers.top_gainers) &&
                topMovers.top_gainers.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Hausse</h3>
                    <ul className="space-y-1">
                      {topMovers.top_gainers.map((g, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>
                            <span className="font-mono">{g.ticker}</span>{" "}
                            {g.name && <span className="opacity-80">({g.name})</span>}
                            {g.reason && (
                              <span className="opacity-70"> — {g.reason}</span>
                            )}
                          </span>
                          <span className="text-green-400 font-semibold">
                            +{g.change_pct}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(topMovers.top_losers) &&
                topMovers.top_losers.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Baisse</h3>
                    <ul className="space-y-1">
                      {topMovers.top_losers.map((g, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>
                            <span className="font-mono">{g.ticker}</span>{" "}
                            {g.name && <span className="opacity-80">({g.name})</span>}
                            {g.reason && (
                              <span className="opacity-70"> — {g.reason}</span>
                            )}
                          </span>
                          <span className="text-red-400 font-semibold">
                            {g.change_pct}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </Section>

          {/* MACRO */}
          <Section title="Macro — Croissance, inflation, emploi, banques centrales">
            <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm">
              {Array.isArray(macro.growth) && macro.growth.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1 opacity-80">Croissance</h3>
                  <ul className="space-y-1">
                    {macro.growth.map((m, i) => (
                      <li key={i}>
                        <span className="font-medium">{m.region}</span>{" "}
                        — {m.indicator}: {m.value}
                        {m.comment && (
                          <span className="opacity-70"> — {m.comment}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(macro.inflation) && macro.inflation.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-1 opacity-80">Inflation</h3>
                  <ul className="space-y-1">
                    {macro.inflation.map((m, i) => (
                      <li key={i}>
                        <span className="font-medium">{m.region}</span>{" "}
                        — {m.indicator}: {m.value}
                        {m.comment && (
                          <span className="opacity-70"> — {m.comment}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(macro.employment) &&
                macro.employment.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Emploi</h3>
                    <ul className="space-y-1">
                      {macro.employment.map((m, i) => (
                        <li key={i}>
                          <span className="font-medium">{m.region}</span>{" "}
                          — {m.indicator}: {m.value}
                          {m.comment && (
                            <span className="opacity-70"> — {m.comment}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(macro.central_banks) &&
                macro.central_banks.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">
                      Banques centrales
                    </h3>
                    <ul className="space-y-1">
                      {macro.central_banks.map((m, i) => (
                        <li key={i}>
                          <span className="font-medium">{m.institution}</span>{" "}
                          — {m.stance}
                          {m.comment && (
                            <span className="opacity-70"> — {m.comment}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </Section>

          {/* GÉO / CORPORATE / AGENDA */}
          <Section title="Géopolitique & entreprises">
            <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm">
              {Array.isArray(report.geopolitics) &&
                report.geopolitics.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Géopolitique</h3>
                    <ul className="space-y-1">
                      {report.geopolitics.map((g, i) => (
                        <li key={i}>
                          <span className="font-medium">{g.region}</span>{" "}
                          — {g.event}
                          {g.impact && (
                            <span className="opacity-70"> — {g.impact}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(report.corporate) &&
                report.corporate.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Corporate</h3>
                    <ul className="space-y-1">
                      {report.corporate.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium">{c.company}</span>{" "}
                          — {c.news}
                          {c.impact && (
                            <span className="opacity-70"> — impact : {c.impact}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </Section>

          <Section title="Agenda">
            <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm">
              {Array.isArray(report.agenda?.today) &&
                report.agenda.today.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">Aujourd’hui</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {report.agenda.today.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(report.agenda?.week_ahead) &&
                report.agenda.week_ahead.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1 opacity-80">
                      Reste de la semaine
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                      {report.agenda.week_ahead.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </Section>
        </>
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

  // 🔎 On charge le dernier daily stocké en DB
  let initialReport = null;
  try {
    const row = await prisma.dailyInsight.findFirst({
      orderBy: { day: "desc" },
    });
    if (row?.payload) {
      // Prisma renvoie déjà du JSON utilisable
      initialReport = row.payload;
    }
  } catch (e) {
    console.error("[DAILY /plus/daily] load error:", e);
  }

  return { props: { isAdmin, initialReport } };
}