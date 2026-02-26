import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const cwd = process.cwd();
const distDir = path.join(cwd, 'dist');

const state = { passed: 0, failed: 0, warned: 0 };

function pass(message) {
  state.passed += 1;
  console.log(`[OK] ${message}`);
}

function fail(message) {
  state.failed += 1;
  console.error(`[FAIL] ${message}`);
}

function warn(message) {
  state.warned += 1;
  console.warn(`[WARN] ${message}`);
}

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sizeBytes(filePath) {
  return fs.statSync(filePath).size;
}

function validateDistExists() {
  if (!exists(distDir) || !fs.statSync(distDir).isDirectory()) {
    fail('dist/ not found. Run `npm run build` first.');
    return false;
  }
  pass('dist/ exists');
  return true;
}

function validateRequiredFiles() {
  const required = [
    'index.html',
    'sitemap.xml',
    'robots.txt',
    'manifest.webmanifest',
    'sw.js',
    'favicon.ico',
    'favicon.svg',
    path.join('css', 'critical.css'),
  ];

  for (const rel of required) {
    const full = path.join(distDir, rel);
    if (!exists(full)) fail(`Missing dist file: dist/${rel}`);
    else pass(`Present: dist/${rel}`);
  }

  const localizedRoots = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
  for (const lang of localizedRoots) {
    const rel = path.join(lang, 'index.html');
    const full = path.join(distDir, rel);
    if (!exists(full)) fail(`Missing localized entry point: dist/${rel}`);
    else pass(`Present localized entry point: dist/${rel}`);
  }
}

function validateNoLocalDevSecretsInDist() {
  const forbidden = [path.join('js', 'local-dev-config.js')];
  for (const rel of forbidden) {
    const full = path.join(distDir, rel);
    if (exists(full)) fail(`Forbidden local secret file shipped in dist: dist/${rel}`);
    else pass(`No forbidden local secret file in dist: dist/${rel}`);
  }
}

function validateIndexHtmlBudgets() {
  const indexPath = path.join(distDir, 'index.html');
  if (!exists(indexPath)) return;

  const bytes = sizeBytes(indexPath);
  // The roadmap's "40KB" target is for a much smaller HTML. This project ships a large static document,
  // so we track a practical raw and gzip budget to catch regressions.
  const maxRawBytes = 95 * 1024;
  if (bytes <= maxRawBytes) pass(`dist/index.html raw size OK (${bytes} bytes <= ${maxRawBytes})`);
  else fail(`dist/index.html raw size too large (${bytes} bytes > ${maxRawBytes})`);

  const html = readText(indexPath);
  const gzipBytes = zlib.gzipSync(Buffer.from(html, 'utf8')).length;
  const maxGzipBytes = 25 * 1024;
  if (gzipBytes <= maxGzipBytes)
    pass(`dist/index.html gzip size OK (${gzipBytes} bytes <= ${maxGzipBytes})`);
  else fail(`dist/index.html gzip size too large (${gzipBytes} bytes > ${maxGzipBytes})`);

  // Critical CSS budget (inline or external critical stylesheet).
  const styleMatch = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  const hasExternalCriticalCss = /<link[^>]+href=["'][^"']*critical\.css(?:\?[^"']*)?["']/i.test(
    html
  );
  if (!styleMatch && !hasExternalCriticalCss) {
    fail(
      'No critical CSS strategy found in dist/index.html (expected inline <style> or linked critical.css)'
    );
  } else {
    if (styleMatch) {
      const cssBytes = Buffer.byteLength(styleMatch[1], 'utf8');
      const maxCssBytes = 14 * 1024;
      if (cssBytes <= maxCssBytes)
        pass(`Critical CSS inline budget OK (${cssBytes} bytes <= ${maxCssBytes})`);
      else fail(`Critical CSS inline too large (${cssBytes} bytes > ${maxCssBytes})`);
    } else {
      pass('Critical CSS delivered via external critical.css');
    }
  }

  // Basic SEO markers.
  const mustContain = [
    '<meta name="description"',
    '<link rel="canonical"',
    'application/ld+json',
    'og:title',
    'twitter:card',
  ];
  for (const marker of mustContain) {
    if (html.includes(marker)) pass(`dist/index.html contains "${marker}"`);
    else fail(`dist/index.html missing "${marker}"`);
  }

  // Ensure obvious placeholders are not shipped.
  const forbidden = [
    'G-XXXXXXXXXX',
    'SENTRY_DSN=',
    'o4504458348945408.ingest.sentry.io', // example DSN host from templates
    '__CANONICAL_URL__',
    '__OG_URL__',
    '__SCANNER_URL__',
    'CANONICALURL',
    'OGURL',
    'SCANNERURL',
  ];
  for (const token of forbidden) {
    if (html.includes(token)) fail(`dist/index.html contains forbidden token: ${token}`);
    else pass(`dist/index.html does not contain: ${token}`);
  }

  // Canonical and BreadcrumbList must not contradict each other.
  const canonicalMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );
  const schemaMatch = html.match(
    /<script[^>]*id=["']schema-organization["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (canonicalMatch && schemaMatch) {
    try {
      const canonicalHref = canonicalMatch[1];
      const canonicalNormalized = canonicalHref.replace(/\/+$/, '');
      const schema = JSON.parse(schemaMatch[1]);
      const graph = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [];
      const breadcrumb = graph.find(node => node?.['@type'] === 'BreadcrumbList');
      const itemList = Array.isArray(breadcrumb?.itemListElement) ? breadcrumb.itemListElement : [];
      const breadcrumbEntry =
        itemList.find(item => Number(item?.position) === 2) || itemList[1] || null;
      if (breadcrumbEntry?.item) {
        const breadcrumbNormalized = String(breadcrumbEntry.item).replace(/\/+$/, '');
        if (breadcrumbNormalized === canonicalNormalized) {
          pass('Canonical URL and BreadcrumbList item URL are aligned');
        } else {
          fail(
            `Canonical/Breadcrumb mismatch: canonical="${canonicalHref}" breadcrumb="${breadcrumbEntry.item}"`
          );
        }
      } else {
        const rootEntry =
          itemList.find(item => Number(item?.position) === 1) || itemList[0] || null;
        if (rootEntry?.item) {
          const rootNormalized = String(rootEntry.item).replace(/\/+$/, '');
          if (rootNormalized === canonicalNormalized) {
            pass('Canonical URL and single-level BreadcrumbList root URL are aligned');
          } else {
            fail(
              `Canonical/Breadcrumb root mismatch: canonical="${canonicalHref}" breadcrumb="${rootEntry.item}"`
            );
          }
        } else {
          warn(
            'BreadcrumbList item URL not found; canonical/breadcrumb consistency not fully validated'
          );
        }
      }
    } catch (error) {
      fail(`Failed to validate canonical/breadcrumb consistency: ${error.message}`);
    }
  }
}

function validateStripePublicKeyStatus() {
  const indexPath = path.join(distDir, 'index.html');
  if (!exists(indexPath)) return;

  const html = readText(indexPath);

  const runtimeConfigMatch = html.match(
    /<script[^>]*id=["']runtime-config["'][^>]*>([\s\S]*?)<\/script>/i
  );

  let payload = null;
  if (runtimeConfigMatch) {
    try {
      payload = JSON.parse(runtimeConfigMatch[1]);
      pass('runtime-config loaded from dist/index.html inline script');
    } catch (error) {
      fail(`runtime-config parse failed in dist/index.html: ${error.message}`);
      return;
    }
  } else {
    const externalConfigPath = path.join(distDir, 'config', 'runtime-config.json');
    if (!exists(externalConfigPath)) {
      fail('runtime-config not found (inline script or dist/config/runtime-config.json)');
      return;
    }
    try {
      payload = JSON.parse(readText(externalConfigPath));
      pass('runtime-config loaded from dist/config/runtime-config.json');
    } catch (error) {
      fail(`runtime-config parse failed in dist/config/runtime-config.json: ${error.message}`);
      return;
    }
  }

  const stripeEnabled =
    typeof payload?.payments?.stripeEnabled === 'boolean' ? payload.payments.stripeEnabled : true;
  const stripeKey = String(payload?.payments?.stripePublicKey || '').trim();
  if (!stripeEnabled) {
    pass('Stripe is explicitly disabled in runtime-config (payments.stripeEnabled=false)');
    return;
  }
  if (!stripeKey) {
    warn(
      'Stripe public key is empty in dist/index.html. Checkout with Stripe will remain disabled until injected at deploy time.'
    );
    return;
  }

  if (!/^pk_(live|test)_[A-Za-z0-9]+$/.test(stripeKey)) {
    fail('Stripe public key format is invalid in dist/index.html');
    return;
  }

  pass('Stripe public key is present in dist/index.html');
}

function validateHeadRegressionPolicy() {
  const indexPath = path.join(distDir, 'index.html');
  if (!exists(indexPath)) return;

  const html = readText(indexPath);

  if (/<meta[^>]+name=["'](ISADMINUSER|IS_ADMIN_USER)["']/i.test(html)) {
    fail('dist/index.html contains forbidden admin marker meta');
    return;
  }

  if (/<link[^>]+rel=["']alternate["'][^>]+hreflang=["'][^"']+["'][^>]*\?lang=/i.test(html)) {
    fail('dist/index.html contains hreflang alternates with ?lang query');
    return;
  }

  const preconnectMatches = html.match(/<link[^>]+rel=["']preconnect["'][^>]*>/gi) || [];
  if (preconnectMatches.length > 3) {
    warn(
      `dist/index.html has ${preconnectMatches.length} preconnect links (recommended <= 3 in critical path)`
    );
  } else {
    pass(`dist/index.html preconnect count OK (${preconnectMatches.length})`);
  }

  const appCssHref = '/css/app-deferred.css';
  const appCssTagMatch = html.match(
    new RegExp(
      `<link[^>]+href=["']${appCssHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?[^"']*)?["'][^>]*>`,
      'i'
    )
  );
  if (!appCssTagMatch) {
    fail(`dist/index.html missing stylesheet: ${appCssHref}`);
    return;
  }
  const appCssTag = appCssTagMatch[0];
  const isDeferredStrategy =
    /\smedia=["']print["']/i.test(appCssTag) && /\sdata-deferred-style=["']1["']/i.test(appCssTag);
  if (isDeferredStrategy) {
    const hasInlineOnloadActivation = /\sonload=["']\s*this\.media\s*=\s*['"]all['"]\s*["']/i.test(
      appCssTag
    );
    const noscriptBlocks = html.match(/<noscript>[\s\S]*?<\/noscript>/gi) || [];
    const deferredFallbackFound = noscriptBlocks.some(block =>
      new RegExp(
        `<link[^>]+href=["']${appCssHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?[^"']*)?["'][^>]*>`,
        'i'
      ).test(block)
    );
    if (!deferredFallbackFound) {
      fail(`dist/index.html missing <noscript> fallback for deferred stylesheet: ${appCssHref}`);
      return;
    }
    pass('dist/index.html includes noscript fallback for deferred app-deferred.css');

    if (!hasInlineOnloadActivation) {
      const headInitMatch = html.match(
        /<script[^>]+src=["'](\/js\/index-head-init\.js(?:\?[^"']*)?)["'][^>]*>/i
      );
      if (!headInitMatch) {
        fail(
          'Deferred stylesheet has no inline onload and /js/index-head-init.js loader is missing'
        );
        return;
      }

      const loaderPath = path.join(
        distDir,
        headInitMatch[1].replace(/^\//, '').replace(/\?.*$/, '')
      );
      if (!exists(loaderPath)) {
        fail(`Deferred stylesheet loader file missing: ${loaderPath}`);
        return;
      }
      const loaderJs = readText(loaderPath);
      const hasDeferredActivator =
        /querySelectorAll\(['"]link\[data-deferred-style]\[media="print"]['"]\)/.test(loaderJs) &&
        /link\.media\s*=\s*['"]all['"]/.test(loaderJs);
      if (!hasDeferredActivator) {
        fail(
          'Deferred stylesheet has no inline onload and index-head-init.js lacks a compatible media=print->all activator'
        );
        return;
      }
      pass('Deferred stylesheet activation is provided by CSP-safe JS loader');
    } else {
      pass('Deferred stylesheet activation is provided by inline onload');
    }
  } else {
    pass('dist/index.html app-deferred.css is loaded as a regular stylesheet');
  }

  if (
    !/<link(?=[^>]*\brel=["']preload["'])(?=[^>]*\bhref=["']\/assets\/wifihackx-dashboard-preview\.webp["'])(?=[^>]*\btype=["']image\/webp["'])[^>]*>/i.test(
      html
    )
  ) {
    fail(
      'dist/index.html hero preload /assets/wifihackx-dashboard-preview.webp missing type="image/webp"'
    );
    return;
  }
  pass(
    'dist/index.html hero preload /assets/wifihackx-dashboard-preview.webp declares type=image/webp'
  );

  if (/\[[^\]]*https?:\/\/[^\]]+\]\(\s*https?:\/\/[^)]+\)/i.test(html)) {
    fail('dist/index.html contains markdown link syntax in SEO/schema text');
    return;
  }
}

function validateSitemap() {
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  if (!exists(sitemapPath)) return;
  const xml = readText(sitemapPath);
  if (xml.includes('<urlset') && xml.includes('<url>'))
    pass('sitemap.xml looks valid (basic urlset/url present)');
  else fail('sitemap.xml does not look like a sitemap (missing urlset/url)');
}

function validateRobots() {
  const robotsPath = path.join(distDir, 'robots.txt');
  if (!exists(robotsPath)) return;
  const txt = readText(robotsPath);
  if (/sitemap:\s*/i.test(txt)) pass('robots.txt declares a sitemap');
  else fail('robots.txt missing Sitemap: line');
}

function main() {
  console.log('Dist validation started');

  const ok = validateDistExists();
  if (ok) {
    validateRequiredFiles();
    validateNoLocalDevSecretsInDist();
    validateIndexHtmlBudgets();
    validateStripePublicKeyStatus();
    validateHeadRegressionPolicy();
    validateSitemap();
    validateRobots();
  }

  console.log(`Checks passed: ${state.passed}`);
  console.log(`Checks warned: ${state.warned}`);
  console.log(`Checks failed: ${state.failed}`);

  if (state.failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('Dist validation completed successfully');
}

main();
