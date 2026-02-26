import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://wifihackx.com';
const OUTPUT = path.join(process.cwd(), 'public', 'sitemap.xml');

const routes = [
  {
    path: '/',
    changefreq: 'daily',
    priority: '1.0',
    image: '/assets/og-preview.jpg',
    imageTitle: 'WifiHackX Dashboard',
  },
  { path: '/scanner.html', changefreq: 'weekly', priority: '0.9' },
  { path: '/ip-hunter.html', changefreq: 'weekly', priority: '0.8' },
  { path: '/about.html', changefreq: 'monthly', priority: '0.7' },
  { path: '/faq.html', changefreq: 'weekly', priority: '0.8' },
  { path: '/privacidad.html', changefreq: 'monthly', priority: '0.5' },
  { path: '/terminos.html', changefreq: 'monthly', priority: '0.5' },
];

const now = new Date().toISOString().slice(0, 10);

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml +=
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
  '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

for (const route of routes) {
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}${route.path}</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
  xml += `    <priority>${route.priority}</priority>\n`;

  if (route.image) {
    xml += '    <image:image>\n';
    xml += `      <image:loc>${BASE_URL}${route.image}</image:loc>\n`;
    if (route.imageTitle) {
      xml += `      <image:title>${route.imageTitle}</image:title>\n`;
    }
    xml += '    </image:image>\n';
  }
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, xml, 'utf8');
console.log(`Sitemap generado en ${OUTPUT}`);
