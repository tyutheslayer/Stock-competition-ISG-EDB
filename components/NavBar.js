import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const ANNOUNCE = process.env.NEXT_PUBLIC_ANNOUNCEMENT;
const ANN_LVL = process.env.NEXT_PUBLIC_ANNOUNCEMENT_LEVEL || "info";

export default function NavBar() {
  const { data: session } = useSession();

  return (
    <div className="w-full">
      {/* ... annonce ... */}
      <nav className="navbar bg-base-100 shadow">
        <div className="max-w-5xl mx-auto flex-1 flex items-center justify-between gap-6 px-4">
          <div className="flex gap-4 items-center">
            <Link href="/" className="font-bold hover:underline">Accueil</Link>
            <Link href="/trade" className="hover:underline">Trading</Link>
            <Link href="/portfolio" className="hover:underline">Portefeuille</Link>
            <Link href="/leaderboard" className="hover:underline">Classement</Link>
            <Link href="/rules" className="hover:underline">Règles</Link>
            {/* 🆕 Fiches (contrôle d'accès dans /plus/sheets) */}
            <Link href="/plus/sheets" className="hover:underline">Fiches</Link>
            {(session?.user?.isAdmin || session?.user?.role === 'ADMIN') && (
              <Link href="/admin" className="hover:underline">Admin</Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <Link href="/profile" className="hover:underline">
                  {session.user.name || session.user.email}
                </Link>
                <button onClick={() => signOut()} className="btn btn-xs">Déconnexion</button>
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