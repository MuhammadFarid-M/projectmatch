import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* The dev server proxies /api to Flask so the browser only ever talks to one
   origin. That keeps the session cookie working exactly as it does in
   production and means no CORS layer exists to get out of sync. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: false },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
