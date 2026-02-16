import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  return result.status ?? 1;
}

function runNode(scriptPath, args = []) {
  return run(process.execPath, [scriptPath, ...args]);
}

function runNpx(args = []) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return run(cmd, args);
}

const host = process.env.EXTERNAL_HOST || '';
const url = process.env.EXTERNAL_URL || '';

let failed = 0;

// 1) SSL Labs
{
  const args = [];
  if (host) args.push(`--host=${host}`);
  const status = runNode('tools/external/ssllabs-grade.js', args);
  if (status !== 0) {
    console.error('[validate:external] FAIL: SSL Labs');
    failed += 1;
  } else {
    console.log('[validate:external] OK: SSL Labs');
  }
}

// 2) SecurityHeaders
{
  const args = [];
  if (url) args.push(`--url=${url}`);
  let status = runNode('tools/external/securityheaders-grade.js', args);

  if (status !== 0) {
    // Cloudflare often blocks plain fetch(). Retry with Playwright:
    // 1) local dependency (CI installs it)
    // 2) ephemeral npx package as fallback
    console.log('[validate:external] SecurityHeaders fetch blocked/failed, trying Playwright fallback');
    status = runNode('tools/external/securityheaders-grade-playwright.js', args);
    if (status !== 0) {
      status = runNpx([
        '-y',
        '-p',
        '@playwright/test@1.58.2',
        '--',
        'node',
        'tools/external/securityheaders-grade-playwright.js',
        ...args,
      ]);
    }
  }

  if (status !== 0) {
    console.error('[validate:external] FAIL: SecurityHeaders');
    failed += 1;
  } else {
    console.log('[validate:external] OK: SecurityHeaders');
  }
}

if (failed > 0) {
  console.error(`[validate:external] ${failed}/2 checks failed`);
  process.exit(1);
}

console.log('[validate:external] All external checks passed');
