// pages/admin.js
import Link from "next/link";
import NavBar from "../components/NavBar";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prisma";
import { useMemo, useState, useEffect } from "react";

function FeePanel() {
  const [loading, setLoading] = useState(true);
  const [bps, setBps] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/settings");
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (alive) setBps(Number(j?.tradingFeeBps || 0));
      } catch {
        if (alive) setBps(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
      setBps(Number(j?.tradingFeeBps || 0));
      setMsg({ ok: true, text: "Frais mis à jour" });
    } catch (e) {
      setMsg({ ok: false, text: "Échec mise à jour" });
    } finally {
      setSaving(false);
    }
  }

  function resetBps() {
    setBps(0);
  }

  return (
    <div className="rounded-2xl shadow bg-base-100 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Frais de trading</h2>
        {loading && <span className="loading loading-spinner loading-sm" />}
      </div>
      <div className="flex items-end gap-3">
        <label className="form-control w-48">
          <span className="label-text">Frais (basis points)</span>
          <input
            type="number"
            className="input input-bordered"
            min={0}
            max={10000}
            step={1}
            value={bps}
            onChange={e => setBps(e.target.value)}
            disabled={loading}
          />
        </label>
        <div className="text-sm opacity-70">
          {Number(bps)/100}% — Exemple: 25 bps = 0,25%
        </div>
        <button className="btn btn-outline" onClick={resetBps} disabled={loading || saving}>Remettre à 0</button>
        <button className="btn btn-primary" onClick={save} disabled={loading || saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {msg && (
        <div className={`alert mt-3 ${msg.ok ? "alert-success" : "alert-error"}`}>
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminPage({ me, users }) {
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
    <div>
      <NavBar />
      <main className="page max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Admin</h1>
          <div className="text-sm opacity-70">
            Connecté en tant que&nbsp;<b>{me?.name || me?.email}</b>
          </div>
        </div>

        {/* ⚙️ Panneau frais */}
        <FeePanel />

        <div className="flex items-end gap-3 mb-4">
          <label className="form-control w-72">
            <span className="label-text">Filtrer (nom, email, promo)</span>
            <input
              className="input input-bordered"
              placeholder="Rechercher…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
          <Link className="btn btn-outline" href="/leaderboard">Voir le classement</Link>
        </div>

        <div className="overflow-x-auto rounded-2xl shadow bg-base-100">
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
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  // Vérifie admin
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true }
  });
  const isAdmin = me?.role === "ADMIN";
  if (!isAdmin) return { notFound: true };

  // Liste des utilisateurs
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      cash: true,
      promo: true,
    }
  });

  return {
    props: {
      me,
      users: JSON.parse(JSON.stringify(users)),
    }
  };
}