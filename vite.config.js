import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
