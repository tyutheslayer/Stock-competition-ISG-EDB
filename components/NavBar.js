import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import AnnouncementBar from "./AnnouncementBar";
import Avatar from "./Avatar";

export default function NavBar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <>
      <AnnouncementBar />
      <header className="border-b bg-base-100">
        <nav className="page flex flex-col items-center py-4 gap-4">
          {/* Logo + titre */}
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/logo.jpg" width={120} height={60} alt="ISG Logo" />
            <span className="text-xl font-bold text-primary">StockComp</span>
          </Link>

          {/* Menu principal */}
          <div className="flex gap-6 text-sm flex-wrap justify-center">
            <Link href="/trade" className="hover:underline">Trading</Link>
            <Link href="/portfolio" className="hover:underline">Portefeuille</Link>
            <Link href="/orders" className="hover:underline">Historique</Link>
            <Link href="/watchlist" className="hover:underline">Watchlist</Link>
            <Link href="/leaderboard" className="hover:underline">Classement</Link>
            <Link href="/profile" className="hover:underline">Profil</Link>
            <Link href="/rules" className="hover:underline">Règles</Link>
            {isAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
          </div>

          {/* Actions droite */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!session ? (
              <Link href="/login" className="btn btn-sm bg-primary text-white">Connexion</Link>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Avatar name={session.user?.name} email={session.user?.email} src={session.user?.image} />
                  <span className="text-xs md:text-sm opacity-70">
                    {session.user?.name || session.user?.email}
                  </span>
                </div>
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
    </>
  );
}
