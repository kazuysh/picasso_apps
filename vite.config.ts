import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/react/',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://192.168.0.5:80',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})