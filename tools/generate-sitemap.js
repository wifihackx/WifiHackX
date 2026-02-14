import fs from 'node:fs';
import path from 'node:path';
import { inferBaseUrl } from './site-config.js';

const BASE_URL = inferBaseUrl();
const OUTPUT = path.join(process.cwd(), 'public', 'sitemap.xml');

const routes = [
  '/',
  '/scanner.html',
  '/ip-hunter.html',
  '/about.html',
  '/faq.html',
  '/privacidad.html',
  '/terminos.html'
];

const now = new Date().toISOString().slice(0, 10);

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

for (const route of routes) {
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}${route}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>weekly</changefreq>\n';
  xml += '    <priority>0.8</priority>\n';
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, xml, 'utf8');
console.log(`Sitemap generado en ${OUTPUT}`);
