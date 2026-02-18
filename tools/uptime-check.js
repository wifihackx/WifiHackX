const args = new Set(process.argv.slice(2));
const urlArg = process.argv.find(a => a.startsWith('--url='));
const targetUrl = urlArg?.slice('--url='.length) || process.env.UPTIME_TARGET_URL || 'https://wifihackx.com';
const checkHeaders = args.has('--check-headers') || process.env.UPTIME_CHECK_HEADERS === '1';

const state = { passed: 0, failed: 0 };

function pass(msg) {
  state.passed += 1;
  console.log(`[OK] ${msg}`);
}

function fail(msg) {
  state.failed += 1;
  console.error(`[FAIL] ${msg}`);
}

async function sleep(ms) {
  await new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, attempts = 3, delayMs = 1500) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const start = performance.now();
      const res = await fetch(url, { redirect: 'follow' });
      const ms = Math.round(performance.now() - start);
      return { res, ms };
    } catch (e) {
      last = e;
      if (i < attempts) await sleep(delayMs);
    }
  }
  throw last;
}

async function main() {
  console.log(`Uptime check started: ${targetUrl}`);

  let result;
  try {
    result = await fetchWithRetry(targetUrl, 3, 1500);
  } catch (e) {
    fail(`Unreachable after retries: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const { res, ms } = result;
  if (res.ok) pass(`HTTP OK: ${res.status} (${ms}ms)`);
  else fail(`HTTP not OK: ${res.status} (${ms}ms)`);

  if (checkHeaders) {
    const requiredHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
    ];
    for (const h of requiredHeaders) {
      const v = res.headers.get(h);
      if (v) pass(`Header present: ${h}`);
      else fail(`Header missing: ${h}`);
    }
  } else {
    console.log('[INFO] Header checks disabled. Use --check-headers (or UPTIME_CHECK_HEADERS=1) for security header validation.');
  }

  console.log(`Checks passed: ${state.passed}`);
  console.log(`Checks failed: ${state.failed}`);
  if (state.failed > 0) process.exitCode = 1;
}

main().catch(e => {
  fail(`Unexpected error: ${e.message}`);
  process.exitCode = 1;
});
