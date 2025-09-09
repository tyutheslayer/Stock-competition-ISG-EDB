import { getSession } from "next-auth/react";
import NavBar from "../../components/NavBar";
import { useEffect, useState } from "react";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [resetAmount, setResetAmount] = useState(100000);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [demoteEmail, setDemoteEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function loadUsers() {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers(await r.json());
  }
  useEffect(() => { loadUsers(); }, []);

  async function resetSeason() {
    setMsg("");
    const r = await fetch("/api/admin/reset-season", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startingCash: Number(resetAmount) }),
    });
    setMsg(r.ok ? "Saison réinitialisée." : "Erreur reset.");
    if (r.ok) loadUsers();
  }

  async function setRole(email, role) {
    setMsg("");
    const r = await fetch("/api/admin/user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setMsg(r.ok ? `Rôle mis à jour: ${email} -> ${role}` : "Erreur rôle.");
    if (r.ok) loadUsers();
  }

  async function deleteUser(email) {
    if (!email) return;
    if (!confirm(`Supprimer ${email} ? (positions & ordres supprimés)`)) return;
    const r = await fetch("/api/admin/user/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMsg(r.ok ? `Utilisateur supprimé: ${email}` : "Erreur suppression.");
    if (r.ok) { setDeleteEmail(""); loadUsers(); }
  }

  return (
    <div>
      <NavBar />
      <div className="page py-6">
        <h2 className="text-2xl font-semibold text-center">Admin</h2>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl shadow bg-base-100">
            <h3 className="text-lg font-medium">Réinitialiser la saison</h3>
            <div className="mt-3 flex gap-2 items-center">
              <input className="input input-bordered w-40" type="number" value={resetAmount} onChange={e => setResetAmount(e.target.value)} />
              <button className="btn bg-primary text-white" onClick={resetSeason}>Reset</button>
            </div>
          </div>

          <div className="p-5 rounded-2xl shadow bg-base-100">
            <h3 className="text-lg font-medium">Gestion des rôles</h3>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input className="input input-bordered flex-1" placeholder="email à promouvoir" value={promoteEmail} onChange={e=>setPromoteEmail(e.target.value)} />
                <button className="btn" onClick={()=>setRole(promoteEmail, "ADMIN")}>Promouvoir ADMIN</button>
              </div>
              <div className="flex gap-2">
                <input className="input input-bordered flex-1" placeholder="email à rétrograder" value={demoteEmail} onChange={e=>setDemoteEmail(e.target.value)} />
                <button className="btn" onClick={()=>setRole(demoteEmail, "USER")}>Rétrograder USER</button>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl shadow bg-base-100 md:col-span-2">
            <h3 className="text-lg font-medium">Supprimer un utilisateur</h3>
            <div className="mt-3 flex gap-2">
              <input className="input input-bordered flex-1" placeholder="email à supprimer" value={deleteEmail} onChange={e=>setDeleteEmail(e.target.value)} />
              <button className="btn btn-error" onClick={()=>deleteUser(deleteEmail)}>Supprimer</button>
            </div>
          </div>
        </div>

        <div className="mt-6 p-5 rounded-2xl shadow bg-base-100">
          <h3 className="text-lg font-medium mb-2">Utilisateurs</h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead><tr><th>Email</th><th>Rôle</th><th>Cash</th><th>Equity (approx)</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.email}>
                    <td>{u.email}</td><td>{u.role}</td><td>{u.cash?.toFixed(2)}</td><td>{u.equity?.toFixed?.(2) ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {msg && <p className="mt-4 text-center">{msg}</p>}
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== "ADMIN") {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}
