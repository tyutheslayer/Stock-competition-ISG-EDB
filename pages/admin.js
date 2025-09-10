// pages/admin.js
import Link from "next/link";
import NavBar from "../components/NavBar";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import prisma from "../lib/prisma";
import { useMemo, useState } from "react";

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
                      {/* Export CSV portefeuille */}
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
    select: { id: true, email: true, name: true, role: true, isAdmin: true }
  });
  const isAdmin = me?.isAdmin || me?.role === "ADMIN";
  if (!isAdmin) return { notFound: true };

  // Liste des utilisateurs
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,         // nécessaire pour construire l'URL d'export CSV
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