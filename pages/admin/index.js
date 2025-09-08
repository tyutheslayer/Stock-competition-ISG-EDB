import { getSession } from "next-auth/react";
import NavBar from "../../components/NavBar";
import { useEffect, useState } from "react";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [resetAmount, setResetAmount] = useState(100000);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [demoteEmail, setDemoteEmail] = useState("");
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

  return (
    <div>
      <NavBar />
      <div className="container">
        <h2>Admin</h2>

        <div className="card">
          <h3>Réinitialiser la saison</h3>
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <label>Capital initial: </label>
            <input className="input" type="number" value={resetAmount} onChange={e => setResetAmount(e.target.value)} style={{maxWidth:160}} />
            <button className="btn" onClick={resetSeason}>Reset</button>
          </div>
        </div>

        <div className="card">
          <h3>Gestion des rôles</h3>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <input className="input" placeholder="email à promouvoir" value={promoteEmail} onChange={e=>setPromoteEmail(e.target.value)} style={{maxWidth:280}} />
            <button className="btn" onClick={()=>setRole(promoteEmail, "ADMIN")}>Promouvoir ADMIN</button>

            <input className="input" placeholder="email à rétrograder" value={demoteEmail} onChange={e=>setDemoteEmail(e.target.value)} style={{maxWidth:280}} />
            <button className="btn" onClick={()=>setRole(demoteEmail, "USER")}>Rétrograder USER</button>
          </div>
        </div>

        <div className="card">
          <h3>Utilisateurs</h3>
          <table className="table">
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

        {msg && <p>{msg}</p>}
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
