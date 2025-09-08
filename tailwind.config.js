/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        isg: {
          primary: "#153859",
          secondary: "#1e293b",
          accent: "#2563eb",
          neutral: "#111827",
          "base-100": "#ffffff",
        },
      },
      {
        "isg-dark": {
          primary: "#153859",
          secondary: "#475569",
          accent: "#60a5fa",
          neutral: "#0b1220",
          "base-100": "#0f172a",
        },
      },
    ],
    darkTheme: "isg-dark",
  },
};
