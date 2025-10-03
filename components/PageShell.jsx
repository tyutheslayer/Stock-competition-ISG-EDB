// components/PageShell.jsx
import NeonBackground3D from "./NeonBackground3D"; // tu l'as déjà
import NavBar from "./NavBar";

export default function PageShell({ children }) {
  return (
    <div className="relative min-h-screen">
      <NavBar />
      {/* fond 3D existant */}
      <NeonBackground3D />

      {/* conteneur principal cohérent sur tout le site */}
      <main className="page max-w-6xl mx-auto px-4 md:px-6 lg:px-0 py-6 relative z-10">
        {children}
      </main>
    </div>
  );
}