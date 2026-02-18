import { defineConfig } from 'vite';

export default defineConfig({
  // This environment blocks Node async spawn(), which breaks esbuild's long-lived service.
  // Disable Vite's esbuild transforms/minification and rely on already-optimized static assets.
  esbuild: false,
  build: {
    minify: false,
    cssMinify: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173,
      clientPort: 5173,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
