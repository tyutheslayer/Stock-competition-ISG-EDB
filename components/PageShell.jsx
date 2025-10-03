import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";

export default function PageShell({ children, className = "" }) {
  return (
    <div className="relative min-h-screen">
      {/* Dégradé de fond */}
      <div className="app-gradient" />

      {/* Canvas 3D */}
      <NeonBackground3D className="-z-20" />

      {/* Contenu */}
      <header className="relative z-10">
        <NavBar />
      </header>

      <main
        className={clsx(
          "relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6",
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}