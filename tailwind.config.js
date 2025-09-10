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
