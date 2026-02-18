import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const runLiveChecks = args.has('--live');
const targetUrlArg = process.argv.find(arg => arg.startsWith('--url='));
const targetUrl = targetUrlArg
  ? targetUrlArg.split('=')[1]
  : (process.env.SPRINT5_TARGET_URL ||
      process.env.EXTERNAL_URL ||
      'https://white-caster-466401-g0.web.app');

const state = {
  failed: 0,
  passed: 0,
};

function pass(message) {
  state.passed += 1;
  console.log(`[OK] ${message}`);
}

function fail(message) {
  state.failed += 1;
  console.error(`[FAIL] ${message}`);
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return String(value || '');
}

function ensureIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    fail(`${label} missing "${expected}"`);
    return false;
  }
  return true;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateFirebaseHeaders() {
  const firebasePath = path.join(cwd, 'firebase.json');
  if (!fs.existsSync(firebasePath)) {
    fail('firebase.json not found');
    return;
  }

  let firebaseConfig;
  try {
    firebaseConfig = loadJson(firebasePath);
  } catch (error) {
    fail(`firebase.json is not valid JSON: ${error.message}`);
    return;
  }

  const headers = firebaseConfig?.hosting?.headers;
  if (!Array.isArray(headers) || headers.length === 0) {
    fail('firebase.json hosting.headers is missing or empty');
    return;
  }

  pass('firebase.json hosting.headers is present');

  const globalHeaderEntry = headers.find(entry => entry.source === '**');
  if (!globalHeaderEntry || !Array.isArray(globalHeaderEntry.headers)) {
    fail('Global security headers entry (source "**") not found');
    return;
  }

  const headerMap = new Map(
    globalHeaderEntry.headers.map(item => [item.key, normalizeHeaderValue(item.value)])
  );

  const requiredSecurityHeaders = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'Referrer-Policy',
    'Permissions-Policy',
    // Extra hardening headers that help external scanners (SecurityHeaders/Mozilla Observatory).
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'X-Permitted-Cross-Domain-Policies',
    'X-DNS-Prefetch-Control',
    'X-Download-Options',
    'Origin-Agent-Cluster'
  ];

  for (const key of requiredSecurityHeaders) {
    if (!headerMap.has(key)) {
      fail(`Missing security header in firebase.json: ${key}`);
    } else {
      pass(`Security header configured: ${key}`);
    }
  }

  const csp = headerMap.get('Content-Security-Policy') || '';
  ensureIncludes(csp, "default-src 'self'", 'Content-Security-Policy');
  ensureIncludes(csp, "frame-ancestors 'none'", 'Content-Security-Policy');
  ensureIncludes(csp, "object-src 'none'", 'Content-Security-Policy');

  const hasImageCacheRule = headers.some(entry => entry.source.includes('.{jpg') || entry.source.includes('@(jpg'));
  const hasJsCacheRule = headers.some(entry => entry.source.includes('*.js'));
  const hasCssCacheRule = headers.some(entry => entry.source.includes('*.css'));
  const hasSwCacheRule = headers.some(entry => entry.source === '/sw.js');

  if (!hasImageCacheRule) fail('Image cache rule not found in firebase.json headers');
  else pass('Image cache rule found');

  if (!hasJsCacheRule) fail('JavaScript cache rule not found in firebase.json headers');
  else pass('JavaScript cache rule found');

  if (!hasCssCacheRule) fail('CSS cache rule not found in firebase.json headers');
  else pass('CSS cache rule found');

  if (!hasSwCacheRule) fail('Service worker cache rule (/sw.js) not found in firebase.json headers');
  else pass('Service worker cache rule found');
}

function validateGtmSnippet() {
  const indexPath = path.join(cwd, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail('index.html not found');
    return;
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  const scriptIdMatch =
    html.match(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/i) ||
    html.match(
      /\)\(\s*(?:window|globalThis)\s*,\s*document\s*,\s*['"]script['"]\s*,\s*['"]dataLayer['"]\s*,\s*['"](GTM-[A-Z0-9]+)['"]\s*\)\s*;?/i
    );
  const iframeIdMatch = html.match(/ns\.html\?id=(GTM-[A-Z0-9]+)/i);

  if (!scriptIdMatch) {
    fail('GTM script snippet not found in index.html');
    return;
  }
  pass(`GTM script snippet found (${scriptIdMatch[1]})`);

  if (!iframeIdMatch) {
    fail('GTM noscript iframe snippet not found in index.html');
    return;
  }
  pass(`GTM noscript snippet found (${iframeIdMatch[1]})`);

  if (scriptIdMatch[1] !== iframeIdMatch[1]) {
    fail(`GTM ID mismatch between script (${scriptIdMatch[1]}) and noscript (${iframeIdMatch[1]})`);
  } else {
    pass('GTM script and noscript IDs match');
  }
}

function validateNoExposedSecrets() {
  // Fast checks for common "oops" files. Keep this lightweight to avoid scanning node_modules/dist.
  const repoRoot = cwd;
  const offenders = [];

  const rootFilesToCheck = [
    'serviceAccountKey.json',
  ];

  for (const file of rootFilesToCheck) {
    const fullPath = path.join(repoRoot, file);
    if (fs.existsSync(fullPath)) offenders.push(file);
  }

  // Match Firebase Admin SDK key downloads (common accidental commit).
  const rootListing = fs.readdirSync(repoRoot, { withFileTypes: true });
  for (const entry of rootListing) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (/firebase-adminsdk/i.test(name) && name.toLowerCase().endsWith('.json')) {
      offenders.push(name);
    }
    if (/^functions-backup-.*\.tar\.gz$/i.test(name)) {
      offenders.push(name);
    }
  }

  if (offenders.length > 0) {
    fail(
      `Exposed secrets/artifacts detected in repo root: ${offenders.join(', ')}. ` +
        'Remove them and rotate any leaked credentials.'
    );
    return;
  }

  pass('No exposed secrets/artifacts detected in repo root');
}

async function validateLiveHeaders() {
  const requiredLiveHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security',
    'content-security-policy'
  ];

  async function fetchWithRetry(url, attempts = 3, delayMs = 1500) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fetch(url, { redirect: 'follow' });
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  let response;
  try {
    response = await fetchWithRetry(targetUrl);
  } catch (error) {
    fail(`Live check failed for ${targetUrl} after retries (fetch): ${error.message}`);
    return;
  }

  if (!response.ok) {
    fail(`Live check returned HTTP ${response.status} for ${targetUrl}`);
    return;
  }

  pass(`Live check reachable: ${targetUrl} (${response.status})`);

  for (const header of requiredLiveHeaders) {
    const value = response.headers.get(header);
    if (!value) fail(`Missing live header: ${header}`);
    else pass(`Live header present: ${header}`);
  }

  let cacheResponse;
  const baseUrl = targetUrl.replace(/\/$/, '');
  const cacheCandidates = [
    '/assets/icon-192.png',
    '/favicon.ico',
    '/favicon.svg',
    '/Tecnologia.webp'
  ];
  let cacheUrl = `${baseUrl}${cacheCandidates[0]}`;
  let selectedPath = cacheCandidates[0];
  for (const candidate of cacheCandidates) {
    const probeUrl = `${baseUrl}${candidate}`;
    try {
      const probe = await fetchWithRetry(probeUrl, 1);
      if (probe.ok) {
        cacheUrl = probeUrl;
        selectedPath = candidate;
        break;
      }
    } catch (_error) {
      // Try next candidate
    }
  }
  try {
    cacheResponse = await fetchWithRetry(cacheUrl);
  } catch (error) {
    fail(`Live cache check failed for ${cacheUrl} after retries (fetch): ${error.message}`);
    return;
  }

  if (!cacheResponse.ok) {
    fail(`Live cache check returned HTTP ${cacheResponse.status} for ${cacheUrl}`);
    return;
  }

  const cacheControl = cacheResponse.headers.get('cache-control') || '';
  if (cacheControl.includes('max-age=31536000') && cacheControl.includes('immutable')) {
    pass(`Cache-Control for ${selectedPath} is long-term immutable (${cacheControl})`);
  } else {
    fail(`Unexpected Cache-Control for ${selectedPath}: "${cacheControl}"`);
  }
}

async function main() {
  console.log('Sprint 5 validation started');
  console.log(`Mode: ${runLiveChecks ? 'config + live' : 'config only'}`);

  validateFirebaseHeaders();
  validateGtmSnippet();
  validateNoExposedSecrets();

  if (runLiveChecks) {
    await validateLiveHeaders();
  } else {
    console.log('[INFO] Live checks skipped. Run with --live to validate production headers.');
  }

  console.log(`Checks passed: ${state.passed}`);
  console.log(`Checks failed: ${state.failed}`);

  if (state.failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('Sprint 5 validation completed successfully');
}

main().catch(error => {
  fail(`Unexpected error: ${error.message}`);
  process.exitCode = 1;
});
