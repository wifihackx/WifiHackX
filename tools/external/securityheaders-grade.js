const DEFAULT_URL = 'https://securityheaders.com/';
import { pathToFileURL } from 'node:url';

export function parseGradeFromJson(json) {
  // securityheaders.com json output typically includes "grade" (best-effort).
  const grade = json?.grade || json?.result?.grade || json?.headers?.grade;
  return typeof grade === 'string' ? grade.trim() : '';
}

export function parseGradeFromHtml(html) {
  if (typeof html !== 'string') return '';

  // Cloudflare/anti-bot pages can contain "Edge" etc. Do not guess grades from generic "grade" words.
  const img =
    html.match(/\/images\/([A-F][+-]?)\.png/i) ||
    html.match(/content=\"https:\/\/securityheaders\.com\/images\/([A-F][+-]?)\.png\"/i);
  if (img) return String(img[1]).trim().toUpperCase();

  const el =
    html.match(/class=\"grade\"[^>]*>\s*([A-F][+-]?)\s*</i) ||
    html.match(/aria-label=\"Grade\"[^>]*>\s*([A-F][+-]?)\s*</i);
  if (el) return String(el[1]).trim().toUpperCase();

  return '';
}

export async function fetchSecurityHeadersGrade(targetUrl) {
  const url = new URL(DEFAULT_URL);
  url.searchParams.set('q', targetUrl);
  url.searchParams.set('hide', 'on');
  url.searchParams.set('followRedirects', 'on');

  const headers = {
    // securityheaders.com may block "generic" or missing UA.
    'User-Agent': 'Mozilla/5.0 (compatible; WifiHackXExternalCheck/1.0)',
    Accept: 'text/html,application/json',
  };

  // Try JSON first (if supported).
  const jsonUrl = new URL(url);
  jsonUrl.searchParams.set('output', 'json');

  const tryJson = async () => {
    const res = await fetch(jsonUrl, { redirect: 'follow', headers });
    if (!res.ok) return '';
    const text = await res.text();
    if (/just a moment|cf-challenge|cloudflare/i.test(text)) {
      throw new Error('SecurityHeaders blocked by Cloudflare');
    }
    try {
      const json = JSON.parse(text);
      return parseGradeFromJson(json);
    } catch {
      return '';
    }
  };

  const gradeJson = await tryJson();
  if (gradeJson) return gradeJson;

  const res = await fetch(url, { redirect: 'follow', headers });
  if (!res.ok) throw new Error(`SecurityHeaders HTTP ${res.status}`);
  const html = await res.text();
  if (/just a moment|cf-challenge|cloudflare/i.test(html)) {
    throw new Error('SecurityHeaders blocked by Cloudflare');
  }
  return parseGradeFromHtml(html);
}

async function main() {
  const urlArg = process.argv.find(a => a.startsWith('--url='));
  const targetUrl = urlArg?.slice('--url='.length) || process.env.SECURITYHEADERS_URL || 'https://wifihackx.com';

  console.log(`[securityheaders] Checking grade for ${targetUrl}`);
  const grade = await fetchSecurityHeadersGrade(targetUrl);
  if (!grade) {
    console.error('[securityheaders] FAIL: could not parse grade');
    process.exitCode = 1;
    return;
  }

  console.log(`[securityheaders] Grade: ${grade}`);
  if (grade === 'A+') {
    console.log('[securityheaders] PASS: grade A+');
    return;
  }

  console.error('[securityheaders] FAIL: expected grade A+');
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(`[securityheaders] FAIL: ${e.message}`);
    process.exitCode = 1;
  });
}
