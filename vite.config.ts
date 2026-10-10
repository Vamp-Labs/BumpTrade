import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'esnext',
  },
});
