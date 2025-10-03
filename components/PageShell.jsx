// components/PageShell.jsx
import clsx from "clsx";
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";

export default function PageShell({ children, className = "" }) {
  return (
    <div className="relative min-h-screen">
      {/* Couche dégradée très douce, SOUS la 3D */}
      <div className="app-gradient" />

      {/* Fond 3D – non cliquable, passe sous le contenu */}
      <NeonBackground3D className="-z-20 pointer-events-none" />

      {/* Contenu au-dessus */}
      <header className="relative z-10">
        <NavBar />
      </header>

      <main
        className={clsx(
          "relative z-10 max-w-[1280px] mx-auto px-5 md:px-6 py-6",
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}