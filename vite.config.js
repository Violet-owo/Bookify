import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/ — tuned for Tauri (https://v2.tauri.app/start/frontend/vite/)
export default defineConfig({
  plugins: [react()],
  // Keep Rust/Tauri errors visible in the terminal
  clearScreen: false,
  server: {
    port: 5173,
    // Tauri expects this exact port (devUrl in tauri.conf.json)
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    // WebView2 on Windows 10/11 is evergreen Chromium
    target: 'chrome110',
    // Desktop app: everything is loaded from disk, a larger main chunk is fine
    chunkSizeWarningLimit: 900
  }
})
