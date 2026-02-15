const DEFAULT_API = 'https://api.ssllabs.com/api/v3/analyze';
import { pathToFileURL } from 'node:url';

export function extractEndpointGrades(reportJson) {
  const endpoints = Array.isArray(reportJson?.endpoints) ? reportJson.endpoints : [];
  return endpoints
    .map(ep => ({ ipAddress: ep?.ipAddress || '', grade: ep?.grade || '' }))
    .filter(ep => ep.ipAddress || ep.grade);
}

export function isAllAPlus(grades) {
  if (!Array.isArray(grades) || grades.length === 0) return false;
  return grades.every(g => g.grade === 'A+');
}

export async function checkSslLabsGrade(host, { timeoutMs = 600_000, pollMs = 15_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const url = new URL(DEFAULT_API);
  url.searchParams.set('host', host);
  url.searchParams.set('all', 'done');
  // Prefer cache to avoid long scans and rate limits. If there is no cache, SSL Labs will still start analysis.
  url.searchParams.set('fromCache', 'on');
  url.searchParams.set('startNew', 'off');
  url.searchParams.set('maxAge', '24'); // hours

  let last;
  while (Date.now() < deadline) {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Some endpoints apply stricter rules to "unknown" clients.
        'User-Agent': 'Mozilla/5.0 (compatible; WifiHackXExternalCheck/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      // SSL Labs may throttle (e.g. 529). Retry until deadline.
      if (res.status === 529 || res.status === 503) {
        await new Promise(r => setTimeout(r, pollMs));
        continue;
      }
      throw new Error(`SSL Labs HTTP ${res.status}`);
    }
    last = await res.json();

    const status = String(last?.status || '').toUpperCase();
    if (status === 'READY') return last;
    if (status === 'ERROR') {
      throw new Error(`SSL Labs status=ERROR: ${last?.statusMessage || 'unknown'}`);
    }

    await new Promise(r => setTimeout(r, pollMs));
  }

  throw new Error(`SSL Labs polling timeout after ${timeoutMs}ms (last status=${last?.status || 'unknown'})`);
}

async function main() {
  const hostArg = process.argv.find(a => a.startsWith('--host='));
  const host = hostArg?.slice('--host='.length) || process.env.SSLLABS_HOST || 'wifihackx.com';

  console.log(`[ssllabs] Checking grade for ${host}`);
  const report = await checkSslLabsGrade(host);
  const grades = extractEndpointGrades(report);

  if (grades.length === 0) {
    console.error('[ssllabs] No endpoints/grades found');
    process.exitCode = 1;
    return;
  }

  const summary = grades.map(g => `${g.ipAddress || 'ip?'}=${g.grade || '?'}`).join(', ');
  console.log(`[ssllabs] Endpoints: ${summary}`);

  if (isAllAPlus(grades)) {
    console.log('[ssllabs] PASS: all endpoints grade A+');
    return;
  }

  console.error('[ssllabs] FAIL: expected all endpoints grade A+');
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(`[ssllabs] FAIL: ${e.message}`);
    process.exitCode = 1;
  });
}
