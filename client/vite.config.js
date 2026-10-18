import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '::',
    // 5174 (not 5173) so Super Toto can run alongside TriVista GST ERP's dev
    // server, which uses 5173.
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      ignored: ['**/android/**', '**/dist/**', '**/node_modules/**', '**/.git/**'],
    },
  },
});
