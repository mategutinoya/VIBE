import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Sin recursos incrustados como data: (la CSP del servidor solo permite fuentes de 'self')
  build: { assetsInlineLimit: 0 },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
