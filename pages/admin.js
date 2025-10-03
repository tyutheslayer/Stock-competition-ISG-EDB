// pages/admin.js
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../components/PageShell";
import GlassPanel from "../components/GlassPanel";

import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prisma";

/* ---------- Panneau frais de trading ---------- */
function AdminTradingFees({ initialSettings }) {
  const [loading, setLoading] = useState(!initialSettings);
  const [bps, setBps] = useState(Number(initialSettings?.tradingFeeBps ?? 0));
  const [updatedAt, setUpdatedAt] = useState(initialSettings?.updatedAt || null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (initialSettings) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        if (alive) {
          setBps(Number(j?.tradingFeeBps ?? 0));
          setUpdatedAt(j?.updatedAt || null);
        }
      } catch (e) {
        if (alive) setMsg({ ok: false, text: "Impossible de charger les frais" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [initialSettings]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeeBps: Number(bps) })
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setBps(Number(j?.tradingFeeBps ?? 0));
      setUpdatedAt(j?.updatedAt || null);
      setMsg({ ok: true, text: "Frais mis à jour" });
    } catch {
      setMsg({ ok: false, text: "Échec mise à jour (droits / DB ?)" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassPanel className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Frais de trading</h2>
        {loading && <span className="loading loading-spinner loading-sm" />}
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="form-control w-48">
          <span className="label-text">Basis points (bps)</span>
          <input
            type="number"
            className="input input-bordered"
            min={0}
            max={10000}
            step={1}
            value={bps}
            onChange={e => setBps(e.target.value)}
            disabled={saving}
          />
        </label>
        <div className="text-sm opacity-80">
          {(Number(bps)/100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}% • ex: 25 bps = 0,25%
          {updatedAt && <> • Dernière maj : {new Date(updatedAt).toLocaleString("fr-FR")}</>}
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={()=>setBps(0)} disabled={saving}>
            Remettre à 0
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert mt-3 ${msg.ok ? "alert-success" : "alert-error"}`}>
          <span>{msg.text}</span>
        </div>
      )}
    </GlassPanel>
  );
}

/* ---------- Page Admin ---------- */
export default function AdminPage({ me, users, settings }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u =>
      (u.name || "").toLowerCase().includes(s) ||
      (u.email || "").toLowerCase().includes(s) ||
      (u.promo || "").toLowerCase().includes(s)
    );
  }, [q, users]);

  return (
    <PageShell>
      <div className="grid grid-cols-12 gap-5">
        {/* Header */}
        <section className="col-span-12">
          <GlassPanel>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-3xl font-bold">Admin</h1>
              <div className="text-sm opacity-80">
                Connecté en tant que <b>{me?.name || me?.email}</b>
              </div>
            </div>
          </GlassPanel>
        </section>

        {/* ⚙️ Frais de trading */}
        <section className="col-span-12">
          <AdminTradingFees initialSettings={settings || null} />
        </section>

        {/* Filtres + lien classement */}
        <section className="col-span-12">
          <GlassPanel>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="form-control w-72">
                <span className="label-text">Filtrer (nom, email, promo)</span>
                <input
                  className="input input-bordered"
                  placeholder="Rechercher…"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </label>
              <div className="ml-auto">
                <Link className="btn btn-outline" href="/leaderboard">Voir le classement</Link>
              </div>
            </div>
          </GlassPanel>
        </section>

        {/* Tableau users */}
        <section className="col-span-12">
          <GlassPanel className="p-0">
            <div className="overflow-x-auto rounded-2xl">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Promo</th>
                    <th>Cash</th>
                    <th>Rôle</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td className="max-w-[220px] truncate">{u.name || "—"}</td>
                      <td className="max-w-[260px] truncate">{u.email}</td>
                      <td className="max-w-[120px] truncate">{u.promo || "—"}</td>
                      <td>{Number(u.cash).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>{u.role || (u.isAdmin ? "ADMIN" : "USER")}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            className="btn btn-xs"
                            href={`/api/admin/portfolio/export?userId=${encodeURIComponent(u.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Exporter le portefeuille en CSV"
                          >
                            Export CSV
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 opacity-60">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </section>
      </div>
    </PageShell>
  );
}

/* ---------- SSR ---------- */
export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) return { redirect: { destination: "/login", permanent: false } };

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true }
  });
  if (me?.role !== "ADMIN") return { notFound: true };

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, cash: true, promo: true }
  });

  let settings = null;
  try {
    const s = await prisma.settings.findFirst({ select: { tradingFeeBps: true, updatedAt: true } });
    if (s) settings = { tradingFeeBps: s.tradingFeeBps, updatedAt: s.updatedAt?.toISOString?.() || null };
  } catch { settings = null; }

  return { props: { me, users: JSON.parse(JSON.stringify(users)), settings } };
}