import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite para desarrollo y producción
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirige peticiones /api al backend en desarrollo
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // Redirige peticiones /geoserver al servidor de mapas en desarrollo
      '/geoserver': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separa dependencias grandes en chunks independientes
        manualChunks: {
          mapa: ['maplibre-gl'],
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
  },
})
