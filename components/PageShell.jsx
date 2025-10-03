// components/PageShell.jsx
import NavBar from "./NavBar";
import NeonBackground3D from "./NeonBackground3D";

export default function PageShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Couche 1 : fond uni très sombre */}
      <div className="fixed inset-0 -z-40 bg-[#0a101b]" />

      {/* Couche 2 : dégradés/vignette très légers (ne doit pas masquer le 3D) */}
      <div className="app-gradient fixed inset-0 -z-35 pointer-events-none" />

      {/* Couche 3 : canvas 3D */}
      <NeonBackground3D className="-z-30" />

      {/* Contenu */}
      <NavBar />
      <main className="page">{children}</main>
    </div>
  );
}