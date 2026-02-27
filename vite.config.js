import {
    defineConfig
} from 'vite';
import {
    applyIndexHtmlConstants
} from './tools/index-html-constants.js';

function indexHtmlSeoPlugin() {
    return {
        name: 'index-html-seo',
        transformIndexHtml(html) {
            return applyIndexHtmlConstants(html);
        },
    };
}

export default defineConfig({
    plugins: [indexHtmlSeoPlugin()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: false,
        hmr: {
            port: 5173,
        },
    },
    preview: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
    },
});