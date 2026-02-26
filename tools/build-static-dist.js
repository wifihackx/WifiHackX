import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { applyIndexHtmlConstants } from './index-html-constants.js';
import { LANGUAGE_SEO, SITE_ORIGIN } from './index-html-constants.js';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const publicDir = path.join(root, 'public');
  const distDir = path.join(root, 'dist');
  const rootIndex = path.join(root, 'index.html');
  const distIndex = path.join(distDir, 'index.html');

  if (!(await exists(publicDir))) {
    console.error(`[build] Missing directory: ${publicDir}`);
    process.exit(1);
  }
  if (!(await exists(rootIndex))) {
    console.error(`[build] Missing file: ${rootIndex}`);
    process.exit(1);
  }

  // Clean dist (Firebase hosting target).
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  // 1) Copy /public => /dist
  // 2) Copy root index.html => /dist/index.html (source of truth)
  await fs.cp(publicDir, distDir, { recursive: true });
  await fs.copyFile(rootIndex, distIndex);
  await normalizeIndexHtmlConstants(distIndex);
  await injectStripePublicKey(distIndex);
  await normalizeCurrentYearPlaceholder(distIndex);
  await stampAssetHashes(distIndex, distDir);
  await generateLocalizedEntryPoints(distIndex, distDir);

  // Never ship local-only private config, even if present in developer machine.
  const forbiddenLocalDevConfig = path.join(distDir, 'js', 'local-dev-config.js');
  await fs.rm(forbiddenLocalDevConfig, { force: true });

  console.log('[build] dist prepared from static assets (public/ + root index.html)');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function shortHash(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

async function stampAssetHashes(indexPath, distDir) {
  let html = await fs.readFile(indexPath, 'utf8');
  const assets = [
    '/js/index-head-init.js',
    '/css/critical.css',
    '/css/app-deferred.css',
    '/js/main-entry.js',
  ];

  for (const webPath of assets) {
    const rel = webPath.replace(/^\//, '').split('/');
    const assetPath = path.join(distDir, ...rel);
    if (!(await exists(assetPath))) continue;
    const hash = await shortHash(assetPath);
    const re = new RegExp(`${escapeRegex(webPath)}(?:\\?v=[^\"'\\s>]*)?`, 'g');
    html = html.replace(re, `${webPath}?v=${hash}`);
  }

  await fs.writeFile(indexPath, html, 'utf8');
  console.log('[build] stamped content hashes in dist/index.html');
}

async function normalizeIndexHtmlConstants(indexPath) {
  const html = await fs.readFile(indexPath, 'utf8');
  const updated = applyIndexHtmlConstants(html);
  if (updated !== html) {
    await fs.writeFile(indexPath, updated, 'utf8');
    console.log('[build] normalized index.html SEO/scanner constants');
  }
}

async function injectStripePublicKey(indexPath) {
  const stripePublicKey = String(process.env.WFX_STRIPE_PUBLIC_KEY || '').trim();
  if (!stripePublicKey) return;

  const html = await fs.readFile(indexPath, 'utf8');
  const runtimeConfigRegex = /(<script[^>]*id=["']runtime-config["'][^>]*>)([\s\S]*?)(<\/script>)/i;
  const match = html.match(runtimeConfigRegex);
  if (!match) {
    throw new Error('[build] runtime-config script not found in index.html');
  }

  let config;
  try {
    config = JSON.parse(match[2]);
  } catch (error) {
    throw new Error(`[build] runtime-config JSON parse failed: ${error.message}`);
  }

  if (!config.payments || typeof config.payments !== 'object') {
    config.payments = {};
  }
  config.payments.stripePublicKey = stripePublicKey;

  const updatedScript = `${match[1]}\n${JSON.stringify(config, null, 8)}\n${match[3]}`;
  const updatedHtml = html.replace(runtimeConfigRegex, updatedScript);
  await fs.writeFile(indexPath, updatedHtml, 'utf8');
  console.log('[build] injected Stripe public key from WFX_STRIPE_PUBLIC_KEY');
}

async function normalizeCurrentYearPlaceholder(indexPath) {
  const html = await fs.readFile(indexPath, 'utf8');
  const updated = html.replace(
    /(<span[^>]*class=["'][^"']*\bcurrent-year\b[^"']*["'][^>]*>)([^<]*)(<\/span>)/gi,
    '$1$3'
  );
  if (updated !== html) {
    await fs.writeFile(indexPath, updated, 'utf8');
    console.log('[build] normalized current-year placeholder (runtime-managed)');
  }
}

function localizeIndexHtml(baseHtml, languageSeo) {
  const localePath = String(languageSeo.path || '/').replace(/\/+$/, '/') || '/';
  const localeUrl = `${SITE_ORIGIN}${localePath}`;
  const htmlLang = String(languageSeo.lang || 'es').toLowerCase();
  const ogLocale = String(languageSeo.locale || 'es_ES');
  const schemaLanguage = ogLocale.replace('_', '-');

  let html = baseHtml;

  html = html.replace(/<html\s+lang="[^"]+"/i, `<html lang="${htmlLang}"`);
  html = html.replace(
    /<link[^>]+rel="canonical"[^>]+href="[^"]*"[^>]*>/i,
    `<link rel="canonical" href="${localeUrl}">`
  );
  html = html.replace(
    /<meta[^>]+property="og:url"[^>]+content="[^"]*"[^>]*>/i,
    `<meta property="og:url" content="${localeUrl}">`
  );
  html = html.replace(
    /<meta[^>]+property="og:locale"[^>]+content="[^"]*"[^>]*>/i,
    `<meta property="og:locale" content="${ogLocale}">`
  );

  const schemaRegex = /(<script[^>]*id="schema-organization"[^>]*>)([\s\S]*?)(<\/script>)/i;
  const schemaMatch = html.match(schemaRegex);
  if (schemaMatch) {
    try {
      const payload = JSON.parse(schemaMatch[2]);
      const graph = Array.isArray(payload?.['@graph']) ? payload['@graph'] : [];
      for (const node of graph) {
        if (!node || typeof node !== 'object') continue;
        if (node['@type'] === 'WebPage') {
          node.url = localeUrl;
          node.inLanguage = schemaLanguage;
        }
        if (node['@type'] === 'WebSite') {
          node.inLanguage = schemaLanguage;
        }
        if (node['@type'] === 'BreadcrumbList' && Array.isArray(node.itemListElement)) {
          const second = node.itemListElement.find(item => Number(item?.position) === 2);
          if (second && typeof second === 'object') second.item = localeUrl;
        }
      }
      payload['@graph'] = graph;
      const updatedScript = `${schemaMatch[1]}\n${JSON.stringify(payload, null, 8)}\n    ${schemaMatch[3]}`;
      html = html.replace(schemaRegex, updatedScript);
    } catch (_error) {
      // Keep base schema if JSON cannot be parsed.
    }
  }

  // Keep hreflang static blocks as generated by applyIndexHtmlConstants.
  return html;
}

async function generateLocalizedEntryPoints(distIndexPath, distDir) {
  const baseHtml = await fs.readFile(distIndexPath, 'utf8');
  for (const item of LANGUAGE_SEO) {
    const langCode = String(item.lang || '')
      .trim()
      .toLowerCase();
    if (!langCode) continue;

    const targetDir = path.join(distDir, langCode);
    const targetPath = path.join(targetDir, 'index.html');
    const localizedHtml = localizeIndexHtml(baseHtml, item);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, localizedHtml, 'utf8');
  }

  console.log(
    `[build] generated localized entry points: ${LANGUAGE_SEO.map(item => item.lang).join(', ')}`
  );
}

await main();
