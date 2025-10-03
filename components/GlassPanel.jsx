export default function GlassPanel({ className = "", children }) {
  return (
    <div className={`glass-panel p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}