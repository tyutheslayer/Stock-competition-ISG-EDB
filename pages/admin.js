// pages/admin.js
import Link from "next/link";
import NavBar from "../components/NavBar";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prisma";
import { useMemo, useState, useEffect } from "react";

export default function AdminPage({ me, users }) {
  const [q, setQ] = useState("");

  // --- UI frais ---
  const [feeBps, setFeeBps] = useState(0);
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeMsg, setFeeMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setFeeLoading(true);
        const r = await fetch("/api/admin/settings");
        const j = await r.json();
        setFeeBps(Number(j?.tradingFeeBps ?? 0));
        setFeeMsg(j?.exists ? "" : "⚠️ Utilise la valeur d'env par défaut (table absente).");
      } catch {
        setFeeMsg("⚠️ Impossible de charger les frais.");
      } finally {
        setFeeLoading(false);
      }
    })();
  }, []);

  async function saveFee() {
    setFeeMsg("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeeBps: Number(feeBps) })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setFeeMsg(j?.error || "Échec enregistrement.");
      } else {
        setFeeMsg("✅ Frais enregistrés.");
      }
    } catch {
      setFeeMsg("❌ Erreur réseau.");
    }
  }

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

        {/* -------- Carte Frais de trading -------- */}
        <div className="rounded-2xl shadow bg-base-100 p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Frais de trading</h2>
          <p className="text-sm opacity-70 mb-2">
            Définis les frais en <b>basis points</b> (ex: 25 = 0,25%). Appliqués aux achats et aux ventes, sur le montant en EUR après conversion.
          </p>
          <div className="flex items-end gap-3">
            <label className="form-control w-40">
              <span className="label-text">Frais (bps)</span>
              <input
                type="number"
                min={0}
                className="input input-bordered"
                value={feeBps}
                onChange={(e)=>setFeeBps(e.target.value)}
                disabled={feeLoading}
              />
            </label>
            <button className="btn btn-primary" onClick={saveFee} disabled={feeLoading}>
              Enregistrer
            </button>
            {feeMsg && <span className="text-sm">{feeMsg}</span>}
          </div>
        </div>

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

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true, isAdmin: true }
  });
  const isAdmin = me?.isAdmin || me?.role === "ADMIN";
  if (!isAdmin) return { notFound: true };

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isAdmin: true,
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