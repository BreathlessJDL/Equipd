import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep the framework in its own long-lived chunk so route chunks and
        // app code can change without re-downloading React on every deploy.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          return null
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    open: true,
    watch: {
      // Seed-only assets; avoids Windows EBUSY crashes when files are written.
      ignored: ['**/public/dev-seed-images/**'],
    },
  },
})
