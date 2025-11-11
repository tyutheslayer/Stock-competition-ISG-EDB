// components/NavBar.js
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useMemo } from "react";
import { Menu, X } from "lucide-react";

const ANNOUNCE = process.env.NEXT_PUBLIC_ANNOUNCEMENT;
const ANN_LVL = process.env.NEXT_PUBLIC_ANNOUNCEMENT_LEVEL || "info";
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/ybbvq44t";
const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/ecoledelabourse_isg?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";

export default function NavBar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const isPlus = useMemo(() => {
    const u = session?.user;
    return u?.isPlusActive === true || u?.plusStatus === "active" || u?.role === "ADMIN";
  }, [session]);

  return (
    <div className="w-full">
      {ANNOUNCE && (
        <div
          className={`text-center py-2 text-sm ${
            ANN_LVL === "warning"
              ? "bg-yellow-500/20 text-yellow-300"
              : ANN_LVL === "error"
              ? "bg-red-500/20 text-red-300"
              : "bg-primary/20 text-primary"
          }`}
        >
          {ANNOUNCE}
        </div>
      )}

      <nav className="navbar bg-base-100/80 backdrop-blur-md shadow sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex-1 flex items-center justify-between px-4">
          {/* Accueil -> /plus si Plus/Admin */}
          <div className="flex items-center gap-3">
            <Link
              href={isPlus ? "/plus" : "/"}
              className="font-bold text-lg hover:underline whitespace-nowrap"
              onClick={() => setOpen(false)}
            >
              Accueil
            </Link>
          </div>

          <button
            className="md:hidden btn btn-ghost btn-sm"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden md:flex gap-4 items-center">
            <Link href="/trade" className="hover:underline">Trading</Link>
            <Link href="/portfolio" className="hover:underline">Portefeuille</Link>
            <Link href="/leaderboard" className="hover:underline">Classement</Link>
            <Link href="/rules" className="hover:underline">Règles</Link>
            <Link href="/plus/sheets" className="hover:underline">Fiches</Link>
            <Link href="/quizzes" className="hover:underline">Quiz</Link>

            {/* Réseaux — masqués pour PLUS */}
            {!isPlus && (
              <>
                <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="hover:underline">Discord</a>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="hover:underline">Instagram</a>
              </>
            )}

            {(session?.user?.isAdmin || session?.user?.role === "ADMIN") && (
              <Link href="/admin" className="hover:underline">Admin</Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
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

        {open && (
          <div className="md:hidden bg-base-200/90 backdrop-blur-md border-t border-white/10 shadow-inner">
            <div className="flex flex-col items-start p-4 space-y-3">
              <Link href="/trade" onClick={() => setOpen(false)}>Trading</Link>
              <Link href="/portfolio" onClick={() => setOpen(false)}>Portefeuille</Link>
              <Link href="/leaderboard" onClick={() => setOpen(false)}>Classement</Link>
              <Link href="/rules" onClick={() => setOpen(false)}>Règles</Link>
              <Link href="/plus/sheets" onClick={() => setOpen(false)}>Fiches</Link>
              <Link href="/quizzes" onClick={() => setOpen(false)}>Quiz</Link>

              {!isPlus && (
                <>
                  <a href={DISCORD_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Discord</a>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Instagram</a>
                </>
              )}

              {(session?.user?.isAdmin || session?.user?.role === "ADMIN") && (
                <Link href="/admin" onClick={() => setOpen(false)}>Admin</Link>
              )}

              <hr className="w-full border-white/10 my-2" />
              {session?.user ? (
                <>
                  <Link href="/profile" onClick={() => setOpen(false)}>
                    Profil ({session.user.name || session.user.email})
                  </Link>
                  <button
                    onClick={() => { setOpen(false); signOut(); }}
                    className="btn btn-xs btn-outline mt-2"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="btn btn-xs btn-primary mt-2 w-full"
                  onClick={() => setOpen(false)}
                >
                  Connexion
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}