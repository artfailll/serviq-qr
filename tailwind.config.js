/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm restaurant palette
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(15, 23, 42, 0.08), 0 4px 24px -6px rgba(15, 23, 42, 0.10)',
        glow: '0 8px 40px -8px rgba(249, 115, 22, 0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.96)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.5)' },
          '70%': { boxShadow: '0 0 0 12px rgba(249,115,22,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'pop': 'pop 0.25s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'shake': 'shake .4s ease-in-out',
      },
    },
  },
  plugins: [],
}
