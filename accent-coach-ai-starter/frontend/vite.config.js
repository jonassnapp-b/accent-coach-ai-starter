import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kun til LOCAL dev: vi proxy'er /api-kald til lokal backend
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',   // din backend lokalt
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
