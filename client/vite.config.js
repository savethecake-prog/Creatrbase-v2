import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Dev-only: proxy the agencies service to production so the intake form and the
      // pool-preview interstitial can be exercised locally against the live backend.
      '/agencies-svc': {
        target: 'https://creatrbase.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
})
