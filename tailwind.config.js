/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    // On déclare deux thèmes: clair (isg) et sombre (isgDark)
    themes: [
      {
        isg: {
          "primary": "#153859",
          "secondary": "#3b82f6",
          "accent": "#22c55e",
          "neutral": "#111827",
          "base-100": "#ffffff",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
        },
      },
      {
        isgDark: {
          "primary": "#4f83b6",
          "secondary": "#60a5fa",
          "accent": "#22c55e",
          "neutral": "#1f2937",
          "base-100": "#0f172a",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
        },
      },
    ],
  },
};
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      // thème clair par défaut (garde le tien si tu en as un)
      "light",
      // thème sombre par défaut
      "dark",
      // 🎛️ thème Plus futuriste
      {
        edbplus: {
          "color-scheme": "dark",
          primary: "#6EE7F9",   // cyan néon
          "primary-content": "#0A0F1E",
          secondary: "#A78BFA", // violet néon
          accent: "#22D3EE",
          neutral: "#0B1220",
          "base-100": "#0C1324",
          "base-200": "#0A1020",
          "base-300": "#090D1A",
          info: "#38BDF8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
      },
    ],
  },
};
