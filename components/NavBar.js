import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();
  return (
    <nav className="nav">
      <Link href="/">Accueil</Link>
      <Link href="/trade">Trading</Link>
      <Link href="/portfolio">Portefeuille</Link>
      <Link href="/leaderboard">Classement</Link>
      <div style={{flex:1}} />
      {session ? (
        <>
          <span>{session.user?.email}</span>
          <button className="btn" onClick={() => signOut({ callbackUrl: "/" })}>Déconnexion</button>
        </>
      ) : (
        <Link href="/login">Connexion</Link>
      )}
    </nav>
  );
}
