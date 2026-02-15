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
          const p = id.replaceAll('\\\\', '/');

          if (p.includes('node_modules')) {
            if (p.includes('firebase')) return 'vendor-firebase';
            if (p.includes('@sentry')) return 'vendor-sentry';
            if (p.includes('chart.js')) return 'vendor-chart';
            if (p.includes('dompurify')) return 'vendor-dompurify';
            if (p.includes('lucide')) return 'vendor-lucide';
            return 'vendor';
          }

          if (p.includes('/src/js/modules/payments/')) return 'mod-payments';
          if (p.includes('/src/js/modules/admin/')) return 'mod-admin';
          if (p.includes('/src/js/modules/features/')) return 'mod-features';
          if (p.includes('/src/js/modules/data/')) return 'mod-data';
          if (p.includes('/src/js/modules/ui/')) return 'mod-ui';
          if (p.includes('/src/js/modules/auth/')) return 'mod-auth';

          // Shared state is used by both core and auth; keep it split to avoid circular chunks.
          if (p.includes('/src/js/core/app-state.js')) return 'shared-state';

          if (p.includes('/src/js/core/')) return 'core-runtime';
        },
      },
    },
  },
});
