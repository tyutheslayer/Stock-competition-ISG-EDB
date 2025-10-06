// components/GlassPanel.jsx
export default function GlassPanel({ className = "", children }) {
  return (
    <div
      className={[
        // ✅ Effet glass adaptatif
        "border border-white/15 bg-white/10 backdrop-blur-md",
        // ✅ Coins et ombres selon la taille d’écran
        "rounded-xl sm:rounded-2xl",
        "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)] sm:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]",
        // ✅ Padding réactif
        "p-3 sm:p-4 md:p-5",
        // ✅ Transition douce pour les hover sur mobile-friendly cards
        "transition-all duration-200 hover:bg-white/15",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}