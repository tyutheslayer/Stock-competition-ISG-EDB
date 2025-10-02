import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle"; // ⬅️ important : on importe le toggle

const ANNOUNCE = process.env.NEXT_PUBLIC_ANNOUNCEMENT;
const ANN_LVL = process.env.NEXT_PUBLIC_ANNOUNCEMENT_LEVEL || "info";

export default function NavBar() {
  const { data: session } = useSession();

  // ✅ détecter le statut Plus pour afficher "Fiches"
  const [plusStatus, setPlusStatus] = useState("none"); // "active" | "pending" | "canceled" | "none"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/plus/status");
        const j = await r.json();
        if (alive) setPlusStatus(String(j?.status || "none").toLowerCase());
      } catch {
        if (alive) setPlusStatus("none");
      }
    })();
    return () => { alive = false; };
  }, []);
  const isPlus = plusStatus === "active";

  return (
    <div className="w-full">
      {/* Bandeau d'annonce global (optionnel) */}
      {ANNOUNCE && (
        <div
          className={`w-full ${
            ANN_LVL === "warning"
              ? "alert alert-warning"
              : ANN_LVL === "error"
              ? "alert alert-error"
              : "alert alert-info"
          } rounded-none`}
        >
          <div className="max-w-5xl mx-auto">{ANNOUNCE}</div>
        </div>
      )}

      {/* Barre de navigation */}
      <nav className="navbar bg-base-100 shadow">
        <div className="max-w-5xl mx-auto flex-1 flex items-center justify-between gap-6 px-4">
          {/* Liens gauche */}
          <div className="flex gap-4 items-center">
            <Link href="/" className="font-bold hover:underline">Accueil</Link>
            <Link href="/trade" className="hover:underline">Trading</Link>
            <Link href="/portfolio" className="hover:underline">Portefeuille</Link>
            <Link href="/leaderboard" className="hover:underline">Classement</Link>
            <Link href="/rules" className="hover:underline">Règles</Link>

            {/* ✅ Onglet Fiches visible seulement pour Plus actifs */}
            {isPlus && (
              <Link href="/plus/sheets" className="hover:underline">Fiches</Link>
            )}

            {(session?.user?.isAdmin || session?.user?.role === "ADMIN") && (
              <Link href="/admin" className="hover:underline">Admin</Link>
            )}
          </div>

          {/* Actions droite */}
          <div className="flex items-center gap-4">
            {/* ⬇️ Le switch clair/sombre est ici, toujours visible */}
            <ThemeToggle />

            {session?.user ? (
              <>
                <Link href="/profile" className="hover:underline">
                  {session.user.name || session.user.email}
                </Link>
                <button onClick={() => signOut()} className="btn btn-xs">
                  Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="btn btn-xs">Connexion</Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}