import fs from 'node:fs';
import path from 'node:path';
import { inferBaseUrl } from './site-config.js';

const BASE_URL = inferBaseUrl();
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const ROBOTS_OUTPUT = path.join(PUBLIC_DIR, 'robots.txt');
const SITEMAP_IMAGES_OUTPUT = path.join(PUBLIC_DIR, 'sitemap-images.xml');
const now = new Date().toISOString().slice(0, 10);

const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/
Disallow: /api/
Disallow: /*.json$

Sitemap: ${BASE_URL}/sitemap.xml

User-agent: Baiduspider
Crawl-delay: 5

User-agent: Yandex
Crawl-delay: 2

User-agent: SemrushBot
Disallow: /

User-agent: AhrefsBot
Crawl-delay: 10
`;

const sitemapImages = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <image:image>
      <image:loc>${BASE_URL}/assets/og-preview.jpg</image:loc>
    </image:image>
  </url>
</urlset>
`;

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(ROBOTS_OUTPUT, robots, 'utf8');
fs.writeFileSync(SITEMAP_IMAGES_OUTPUT, sitemapImages, 'utf8');

console.log(`SEO static files generated: ${ROBOTS_OUTPUT}, ${SITEMAP_IMAGES_OUTPUT}`);

