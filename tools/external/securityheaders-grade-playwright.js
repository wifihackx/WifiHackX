import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

function parseGradeFromUrl(url) {
  if (!url) return '';
  const m = String(url).match(/\/images\/([A-F][+-]?)\.png/i);
  return m ? String(m[1]).toUpperCase() : '';
}

async function main() {
  const urlArg = process.argv.find(a => a.startsWith('--url='));
  const targetUrl = urlArg?.slice('--url='.length) || process.env.SECURITYHEADERS_URL || 'https://wifihackx.com';
  const scanUrl = `https://securityheaders.com/?q=${encodeURIComponent(targetUrl)}&followRedirects=on&hide=on`;

  console.log(`[securityheaders:pw] Checking grade for ${targetUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(scanUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForLoadState('networkidle', { timeout: 120_000 });

    // Best signal: og:image uses /images/<grade>.png on real result pages.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null);
    let grade = parseGradeFromUrl(ogImage);

    if (!grade) {
      const img = await page.locator('img[src*="/images/"]').first().getAttribute('src').catch(() => null);
      grade = parseGradeFromUrl(img);
    }

    if (!grade) {
      // Fallback: look for a big grade letter in text.
      const text = await page.content();
      const m = text.match(/\/images\/([A-F][+-]?)\.png/i);
      if (m) grade = String(m[1]).toUpperCase();
    }

    if (!grade) {
      throw new Error('could not determine grade (page structure blocked/changed)');
    }

    console.log(`[securityheaders:pw] Grade: ${grade}`);
    if (grade !== 'A+') {
      console.error('[securityheaders:pw] FAIL: expected grade A+');
      process.exitCode = 1;
      return;
    }

    console.log('[securityheaders:pw] PASS: grade A+');
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(`[securityheaders:pw] FAIL: ${e.message}`);
    process.exitCode = 1;
  });
}

