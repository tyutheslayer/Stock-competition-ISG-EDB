// pages/admin.js
import Link from "next/link";
import NavBar from "../components/NavBar";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prisma";
import { useMemo, useState, useEffect } from "react";

function FeeCard() {
  const [bps, setBps] = useState("");
  const [source, setSource] = useState("env");
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    try {
      const r = await fetch("/api/admin/settings");
      if (!r.ok) throw new Error();
      const j = await r.json();
      setBps(String(j.tradingFeeBps ?? 0));
      setSource(j.source || "env");
    } catch {
      setBps("0");
      setSource("env");
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setMsg("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeeBps: Number(bps) })
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok) {
        setMsg(j?.error || "Échec sauvegarde");
        // recharger pour refléter la source réelle
        await load();
        return;
      }
      setMsg("✅ Enregistré");
      setSource(j.source || "db");
    } catch (e) {
      setMsg("❌ Échec sauvegarde");
    }
  }

  return (
    <div className="rounded-2xl shadow bg-base-100 p-4 mb-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Frais de trading</div>
          <div className="text-sm opacity-70">
            Appliqué sur chaque ordre (achat/vente), en basis points (bps).
            &nbsp;Ex: 25 = 0,25%.
          </div>
        </div>
        <label className="form-control w-40">
          <span className="label-text">Frais (bps)</span>
          <input
            className="input input-bordered"
            type="number"
            min="0"
            max="10000"
            value={bps}
            onChange={(e)=>setBps(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" onClick={save}>Enregistrer</button>
        <button className="btn btn-ghost" onClick={load}>Actualiser</button>
        <div className="text-sm opacity-70">
          Source: <b>{source === "db" ? "Base de données" : "Variable d’environnement"}</b>
          {source !== "db" && (
            <span className="ml-2">
              (définis <code>DEFAULT_TRADING_FEE_BPS</code> pour le fallback)
            </span>
          )}
        </div>
      </div>
      {msg && <div className="mt-2">{msg}</div>}
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

        {/* ---- Carte paramètres frais ---- */}
        <FeeCard />

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
                  <td>{u.role || "USER"}</td>
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

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true }
  });
  if (me?.role !== "ADMIN") return { notFound: true };

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