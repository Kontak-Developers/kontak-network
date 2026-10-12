import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Göreli: prod'da panel.kontakdating.com/ag/ altından sunuluyor
  base: './',
  plugins: [react()],
  server: {
    // data/mock/ repo kökünde
    fs: { allow: ['..'] },
    // backend: cd backend && npx wrangler dev (8787)
    proxy: { '/api': 'http://localhost:8787' },
  },
})
