// tailwind.config.js
module.exports = {
  content: ['./pages/**/*.{js,jsx,ts,tsx}','./components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#579FD0',  // primaire
          600: '#3E88BB',
        },
        surface: {
          900: '#0B1220',  // fond profond
          800: '#0F1E2D',
          700: '#101827'
        },
        accent: {
          cyan: '#00E5FF',
          orange: '#FF8A00'
        }
      },
      boxShadow: {
        neon: '0 0 16px rgba(0,229,255,.35), inset 0 0 6px rgba(0,229,255,.15)',
        cta:  '0 0 16px rgba(255,138,0,.35), inset 0 0 6px rgba(255,138,0,.15)'
      },
      fontFamily: {
        display: ['var(--font-orbitron)', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
};