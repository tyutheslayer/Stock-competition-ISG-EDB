/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['"Orbitron"', "ui-sans-serif", "system-ui"],
      },
      colors: {
        brand: {
          primary: "#579FD0",
          dark1: "#0B1220",
          dark2: "#0F1E2D",
          dark3: "#101827",
          accent1: "#00E5FF",
          accent2: "#FF8A00",
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        edbtheme: {
          primary: "#579FD0",
          "primary-content": "#0B1220",

          secondary: "#0F1E2D",
          accent: "#00E5FF",
          neutral: "#101827",

          "base-100": "#0B1220",
          "base-200": "#0F1E2D",
          "base-300": "#101827",

          info: "#579FD0",
          success: "#16a34a",
          warning: "#f59e0b",
          error: "#ef4444",
        },
        plus: {
          "primary": "#d4af37",        // Or principal
          "secondary": "#f0e68c",      // Or clair
          "accent": "#c6b16f",
          "neutral": "#1a1a1a",        // Noir profond
          "base-100": "#0e0e0e",       // Fond principal (marbre noir)
          "info": "#bca65a",
          "success": "#f7d674",
          "warning": "#ffd700",
          "error": "#e0b030",
        },
      },
      "dark",
    ],
    darkTheme: "edbtheme",
  },
};