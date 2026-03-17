/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        delta: {
          bg: '#080c14',
          card: '#0d1421',
          border: '#1e2d45',
          accent: '#00c6ff',
          green: '#00e676',
          red: '#ff4757',
          gold: '#ffd700',
          text: '#c9d6e3',
          muted: '#6b7fa0',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
