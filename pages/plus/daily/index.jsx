// pages/plus/daily/index.jsx
import PageShell from "../../../components/PageShell";
import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

function Section({ title, children }) {
  return (
    <section className="rounded-3xl glass p-6 mb-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

// outil : convertit change_pct en couleur / signe
function pct(n) {
  const fixed = Number(n).toFixed(2);
  const color = n >= 0 ? "text-green-400" : "text-red-400";
  const sign = n >= 0 ? "+" : "";
  return <span className={color}>{sign}{fixed}%</span>;
}

export default function DailyPage({ insight }) {
  const j = insight.json;

  return (
    <PageShell>
      <Section title={`Daily Insights — ${insight.date}`}>
        <p className="opacity-80 mb-3">{j.summary}</p>

        {/* === Indices graphique === */}
        <div className="h-64 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={j.markets.indices}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
              <XAxis dataKey="name" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ffda73"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* === Indices listés === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {j.markets.indices.map((i) => (
            <div key={i.name} className="rounded-2xl glass p-4">
              <div className="font-medium">{i.name}</div>
              <div className="text-lg">{i.value}</div>
              <div>{pct(i.change_pct)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* FOREX */}
      <Section title="Forex">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {j.markets.forex.map((f) => (
            <div key={f.pair} className="rounded-2xl glass p-4">
              <div className="font-medium">{f.pair}</div>
              <div className="text-lg">{f.value}</div>
              {pct(f.change_pct)}
            </div>
          ))}
        </div>
      </Section>

      {/* COMMODITIES */}
      <Section title="Commodities">
        {j.markets.commodities.map((c) => (
          <div key={c.asset} className="rounded-2xl glass p-4 mb-3">
            <div className="font-medium">{c.asset}</div>
            <div className="text-lg">{c.value}</div>
            {pct(c.change_pct)}
          </div>
        ))}
      </Section>

      {/* TOP MOVERS */}
      <Section title="Top Gainers / Losers">
        <h3 className="font-semibold">Top Gainers</h3>
        <ul className="mb-4">
          {j.top_movers.top_gainers.map((g) => (
            <li key={g.ticker}>
              {g.ticker} — {pct(g.change_pct)} : {g.reason}
            </li>
          ))}
        </ul>

        <h3 className="font-semibold">Top Losers</h3>
        <ul>
          {j.top_movers.top_losers.map((g) => (
            <li key={g.ticker}>
              {g.ticker} — {pct(g.change_pct)} : {g.reason}
            </li>
          ))}
        </ul>
      </Section>

      {/* MACRO */}
      <Section title="Macro">
        <pre className="whitespace-pre-wrap text-sm opacity-90">
          {JSON.stringify(j.macro, null, 2)}
        </pre>
      </Section>

      {/* CORPORATE */}
      <Section title="Corporate News">
        <pre className="whitespace-pre-wrap text-sm opacity-90">
          {JSON.stringify(j.corporate, null, 2)}
        </pre>
      </Section>
    </PageShell>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const u = session?.user;

  const isPlus = u?.isPlusActive || u?.role === "ADMIN";
  if (!isPlus) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const row = await prisma.dailyInsight.findFirst({
    orderBy: { date: "desc" }
  });

  return {
    props: {
      insight: {
        date: row.date.toISOString().slice(0, 10),
        json: row.json
      }
    }
  };
}