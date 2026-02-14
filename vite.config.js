import { defineConfig } from 'vite';

const hmrHost = process.env.VITE_HMR_HOST || 'localhost';
const hmrProtocol = process.env.VITE_HMR_PROTOCOL || 'ws';
const hmrPort = Number(process.env.VITE_HMR_PORT || 5173);
const disableHmr = process.env.VITE_DISABLE_HMR === '1';

export default defineConfig({
  server: {
    host: process.env.VITE_DEV_HOST || 'localhost',
    port: 5173,
    strictPort: true,
    hmr: disableHmr
      ? false
      : {
          protocol: hmrProtocol,
          host: hmrHost,
          port: hmrPort,
          clientPort: hmrPort,
          timeout: 120000,
          overlay: false,
        },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 180,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;

          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('chart.js')) return 'vendor-chart';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            if (id.includes('lucide')) return 'vendor-lucide';
            return 'vendor';
          }

          if (id.includes('/src/js/modules/payments/')) return 'mod-payments';
          if (id.includes('/src/js/modules/admin/')) return 'mod-admin';
          if (id.includes('/src/js/modules/features/')) return 'mod-features';
          if (id.includes('/src/js/modules/data/')) return 'mod-data';
          if (id.includes('/src/js/modules/ui/')) return 'mod-ui';
          if (id.includes('/src/js/modules/auth/')) return 'mod-auth';
          if (id.includes('/src/js/core/')) return 'core-runtime';
        },
      },
    },
  },
});
