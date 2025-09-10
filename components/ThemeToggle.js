import { useEffect, useState } from "react";

const LIGHT = "isg";
const DARK  = "isgDark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(LIGHT);

  // initialise depuis localStorage sinon thème clair
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("theme") || LIGHT;
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // applique à chaque changement
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const checked = theme === DARK;

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="text-sm" aria-hidden>🌞</span>
      <input
        type="checkbox"
        className="toggle"
        checked={checked}
        onChange={(e) => setTheme(e.target.checked ? DARK : LIGHT)}
        aria-label="Basculer clair/sombre"
      />
      <span className="text-sm" aria-hidden>🌙</span>
    </label>
  );
}
