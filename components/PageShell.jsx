// components/PageShell.jsx
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";

export default function PageShell({ children, noNav = false }) {
  return (
    <div className="relative min-h-screen">
      {/* Dégradé "peinture mur" au fond */}
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(1200px_800px_at_70%_-10%,rgba(26,176,209,0.20),transparent_60%),radial-gradient(900px_700px_at_10%_10%,rgba(88,130,193,0.16),transparent_55%),#0b1622]" />

      {/* 3D au dessus du dégradé, en dessous du contenu */}
      <NeonBackground3D className="-z-10" />

      {!noNav && <div className="relative z-50"><NavBar /></div>}

      {/* Contenu */}
      <main className="relative z-10 page">{children}</main>
    </div>
  );
}