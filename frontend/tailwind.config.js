/** @type {import('tailwindcss').Config} */
export default {
  // Archivos donde Tailwind buscará clases para purgar en producción
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal del sistema municipal
        municipal: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      zIndex: {
        mapa: '0',
        controles: '10',
        panel: '20',
        modal: '50',
        notif: '60',
      },
    },
  },
  plugins: [],
}
