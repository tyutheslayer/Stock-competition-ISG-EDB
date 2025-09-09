import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b bg-base-100">
      <nav className="page flex flex-col items-center py-4 gap-4">
        {/* Logo centré */}
        <Link href="/" className="flex flex-col items-center gap-2">
          <Image src="/logo.jpg" width={120} height={60} alt="ISG Logo" />
          <span className="text-xl font-bold text-primary">StockComp</span>
        </Link>

        {/* Menu centré */}
        <div className="flex gap-6 text-sm">
          <Link href="/trade" className="hover:underline">Trading</Link>
          <Link href="/portfolio" className="hover:underline">Portefeuille</Link>
          <Link href="/leaderboard" className="hover:underline">Classement</Link>
          <Link href="/profile" className="hover:underline">Profil</Link>
          {isAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
        </div>

        {/* Connexion / Déconnexion + switch thème */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!session ? (
            <Link href="/login" className="btn btn-sm bg-primary text-white">Connexion</Link>
          ) : (
            <>
              <span className="text-xs md:text-sm opacity-70">{session.user?.email}</span>
              <button
                className="btn btn-sm bg-primary text-white"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Déconnexion
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
