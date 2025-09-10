import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

export default function AdminPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      const r = await fetch("/api/admin/users/list");
      if (!r.ok) throw new Error(await r.text());
      setRows(await r.json());
    } catch (e) {
      setErr(e.message || "Échec de chargement");
      setRows([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleRole(u) {
    try {
      const r = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, makeAdmin: !(u.isAdmin || u.role === "ADMIN") }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e) {
      alert(e.message || "Échec mise à jour du rôle");
    }
  }

  async function del(u) {
    if (!confirm(`Supprimer ${u.name || u.email} ?`)) return;
    try {
      const r = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e) {
      alert(e.message || "Échec suppression");
    }
  }

  return (
    <div>
      <NavBar />
      <main className="page max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Administration</h1>
        {err && <div className="alert alert-error mb-4">{err}</div>}
        {rows === null && <div className="skeleton h-6 w-40" />}
        {Array.isArray(rows) && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const isAdm = u.isAdmin || u.role === "ADMIN";
                  return (
                    <tr key={u.id}>
                      <td>{u.name || "—"}</td>
                      <td>{u.email}</td>
                      <td>{isAdm ? "ADMIN" : "USER"}</td>
                      <td className="flex gap-2">
                        <button className={`btn btn-xs ${isAdm ? "btn-warning" : "btn-success"}`} onClick={() => toggleRole(u)}>
                          {isAdm ? "Rétrograder" : "Promouvoir"}
                        </button>
                        <button className="btn btn-xs btn-error" onClick={() => del(u)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
