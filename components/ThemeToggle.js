import { useEffect, useState } from "react";

const THEMES = ["isg", "isg-dark"];

export default function ThemeToggle() {
  const [theme, setTheme] = useState("isg");

  // Charger le thème choisi si déjà stocké
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved && THEMES.includes(saved)) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      // Par défaut, clair
      document.documentElement.setAttribute("data-theme", "isg");
    }
  }, []);

  // Appliquer dès que l'utilisateur change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "isg" ? "isg-dark" : "isg"));

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-sm"
      aria-label="Basculer clair/sombre"
      title={theme === "isg" ? "Activer le mode sombre" : "Activer le mode clair"}
    >
      {theme === "isg" ? "🌙 Sombre" : "☀️ Clair"}
    </button>
  );
}
