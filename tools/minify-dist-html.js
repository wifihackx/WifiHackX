import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'html-minifier-terser';

const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');

if (!fs.existsSync(distIndexPath)) {
  console.error('[minify:html] Missing dist/index.html. Run `npm run build` first.');
  process.exit(1);
}

const html = fs.readFileSync(distIndexPath, 'utf8');

const minified = await minify(html, {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  // Avoid touching JSON-LD. (Minifying inline JS is not worth the risk here.)
  minifyJS: false,
  ignoreCustomFragments: [
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
  ],
});

fs.writeFileSync(distIndexPath, minified);

const before = Buffer.byteLength(html, 'utf8');
const after = Buffer.byteLength(minified, 'utf8');
const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;

console.log(`[minify:html] dist/index.html: ${before} -> ${after} bytes (-${pct}%)`);

