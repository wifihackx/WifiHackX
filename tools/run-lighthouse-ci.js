import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const rootDir = process.cwd();
const lhciConfigPath = path.join(rootDir, 'lighthouserc.json');

if (!fs.existsSync(lhciConfigPath)) {
  console.error('[lighthouse:ci] Missing config file: lighthouserc.json');
  process.exit(1);
}

const rawConfig = JSON.parse(fs.readFileSync(lhciConfigPath, 'utf8'));
const collect = rawConfig?.ci?.collect ?? {};
const assertConfig = rawConfig?.ci?.assert?.assertions ?? {};
const uploadConfig = rawConfig?.ci?.upload ?? {};

const staticDistDir = path.resolve(rootDir, collect.staticDistDir ?? './dist');
const urls = Array.isArray(collect.url) && collect.url.length ? collect.url : ['/'];
const numberOfRuns = Number.isFinite(collect.numberOfRuns) ? collect.numberOfRuns : 1;
const settings = collect.settings ?? {};
const outputDir = path.resolve(rootDir, uploadConfig.outputDir ?? '.lighthouseci');

if (!fs.existsSync(staticDistDir)) {
  console.error(`[lighthouse:ci] Missing staticDistDir: ${staticDistDir}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const SOURCEMAP_NOISE_PATTERNS = [
  'Failed to parse source map',
  '.map mapping for column out of bounds',
  'SourceMap.parseMap'
];

function withSuppressedSourcemapNoise(fn) {
  const originalWarn = console.warn;
  const originalError = console.error;
  const shouldSuppress = args => {
    const text = args
      .map(value => (typeof value === 'string' ? value : String(value ?? '')))
      .join(' ');
    return SOURCEMAP_NOISE_PATTERNS.some(pattern => text.includes(pattern));
  };

  console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
  };

  console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
  };

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.warn = originalWarn;
      console.error = originalError;
    });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeByExt[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function startStaticServer(baseDir) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const requestedPath = new URL(req.url ?? '/', 'http://localhost').pathname;
        const decodedPath = decodeURIComponent(requestedPath);
        const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
        let targetPath = path.join(baseDir, normalized);

        if (!targetPath.startsWith(baseDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
          targetPath = path.join(targetPath, 'index.html');
        }

        if (!fs.existsSync(targetPath)) {
          const fallbackPath = path.join(baseDir, 'index.html');
          if (fs.existsSync(fallbackPath)) {
            sendFile(res, fallbackPath);
            return;
          }
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        sendFile(res, targetPath);
      } catch (err) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not get static server address'));
        return;
      }
      resolve({ server, port: address.port });
    });

    server.on('error', reject);
  });
}

function normalizeForFilename(input) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function readMetric(lhr, assertionKey) {
  if (assertionKey.startsWith('categories:')) {
    const categoryKey = assertionKey.slice('categories:'.length);
    const score = lhr.categories?.[categoryKey]?.score;
    if (typeof score !== 'number') return { valid: false };
    return { valid: true, value: score, displayValue: score.toFixed(3) };
  }

  const numeric = lhr.audits?.[assertionKey]?.numericValue;
  if (typeof numeric !== 'number') return { valid: false };

  const displayValue = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time'].includes(assertionKey)
    ? `${Math.round(numeric)}ms`
    : numeric.toString();
  return { valid: true, value: numeric, displayValue };
}

function formatMetricValue(assertionKey, value) {
  if (assertionKey.startsWith('categories:')) return value.toFixed(3);
  if (['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time'].includes(assertionKey)) {
    return `${Math.round(value)}ms`;
  }
  return String(value);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function evaluateAssertionsForRuns(targetPath, lhrs) {
  const failures = [];
  const lines = [];

  for (const [key, rule] of Object.entries(assertConfig)) {
    if (!Array.isArray(rule) || rule.length < 2 || typeof rule[1] !== 'object') continue;
    const level = rule[0];
    const options = rule[1];
    if (level !== 'error') continue;

    const values = [];
    let invalidMetric = false;

    for (const lhr of lhrs) {
      const metric = readMetric(lhr, key);
      if (!metric.valid) {
        invalidMetric = true;
        break;
      }
      values.push(metric.value);
    }

    if (invalidMetric || values.length === 0) {
      failures.push(`${targetPath}: ${key}: metric not found`);
      continue;
    }

    const med = median(values);
    const valuesDisplay = values.map(v => formatMetricValue(key, v)).join(', ');
    const medianDisplay = formatMetricValue(key, med);

    if (typeof options.minScore === 'number' && med < options.minScore) {
      failures.push(`${targetPath}: ${key}: median ${medianDisplay} < minScore ${options.minScore} (runs: ${valuesDisplay})`);
      continue;
    }

    if (typeof options.maxNumericValue === 'number' && med > options.maxNumericValue) {
      failures.push(`${targetPath}: ${key}: median ${medianDisplay} > maxNumericValue ${options.maxNumericValue} (runs: ${valuesDisplay})`);
      continue;
    }

    lines.push(`${targetPath}: ${key}: OK (median ${medianDisplay}; runs: ${valuesDisplay})`);
  }

  return { failures, lines };
}

const { server, port } = await startStaticServer(staticDistDir);
let chrome;

try {
  chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  const allFailures = [];
  const lhrsByTarget = new Map();

  for (const targetPath of urls) {
    const targetLhrs = [];
    for (let run = 1; run <= numberOfRuns; run += 1) {
      const targetUrl = `http://127.0.0.1:${port}${targetPath}`;
      console.log(`[lighthouse:ci] Running ${targetUrl} (${run}/${numberOfRuns})`);

      const runnerResult = await withSuppressedSourcemapNoise(() =>
        lighthouse(
          targetUrl,
          { port: chrome.port, output: 'json', logLevel: 'error' },
          { extends: 'lighthouse:default', settings }
        )
      );

      const reportText = Array.isArray(runnerResult.report) ? runnerResult.report[0] : runnerResult.report;
      const lhr = runnerResult.lhr ?? JSON.parse(reportText);
      const safeBase = normalizeForFilename(`${targetPath || 'root'}-run${run}`);
      const reportPath = path.join(outputDir, `${safeBase}.report.json`);
      fs.writeFileSync(reportPath, reportText, 'utf8');
      targetLhrs.push(lhr);
    }
    lhrsByTarget.set(targetPath, targetLhrs);
  }

  for (const [targetPath, lhrs] of lhrsByTarget.entries()) {
    const { failures, lines } = evaluateAssertionsForRuns(targetPath, lhrs);
    lines.forEach(line => console.log(`[lighthouse:ci] ${line}`));
    failures.forEach(failure => allFailures.push(failure));
  }

  if (allFailures.length > 0) {
    console.error('[lighthouse:ci] Assertions failed:');
    allFailures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log('[lighthouse:ci] All assertions passed.');
    process.exitCode = 0;
  }
} catch (err) {
  console.error('[lighthouse:ci] Unexpected error:', err?.message ?? err);
  process.exitCode = 1;
} finally {
  if (chrome) await chrome.kill();
  await new Promise(resolve => server.close(resolve));
}
