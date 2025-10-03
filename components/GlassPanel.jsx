// components/GlassPanel.jsx
export default function GlassPanel({ className = "", children }) {
  return (
    <div
      className={[
        "rounded-2xl border border-white/15 bg-white/8 backdrop-blur-md",
        "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]",
        "p-4 md:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}