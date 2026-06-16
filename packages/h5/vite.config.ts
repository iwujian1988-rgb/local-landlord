import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output is copied to server/public/h5 so the same cloud-hosted domain serves both API and H5.
// base: '/h5/' so asset URLs in index.html resolve correctly when served under the /h5/ path.
export default defineConfig({
  plugins: [react()],
  base: '/h5/',
  build: {
    outDir: '../server/public/h5',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
