import { spawnSync } from 'node:child_process';

function runNode(scriptPath, args = [], { capture = false } = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: capture ? 'pipe' : 'inherit',
    env: process.env,
    encoding: 'utf8',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function printCapturedOutput(runResult) {
  if (runResult.stdout) process.stdout.write(runResult.stdout);
  if (runResult.stderr) process.stderr.write(runResult.stderr);
}

const checks = [
  { name: 'SSL Labs', script: 'tools/external/ssllabs-grade.js' },
  { name: 'SecurityHeaders', script: 'tools/external/securityheaders-grade.js' },
];

const defaultHost = 'white-caster-466401-g0.web.app';
const defaultUrl = `https://${defaultHost}`;
const host = process.env.EXTERNAL_HOST || defaultHost;
const url = process.env.EXTERNAL_URL || defaultUrl;

let failed = 0;
for (const c of checks) {
  const args = [];
  if (c.name === 'SSL Labs' && host) args.push(`--host=${host}`);
  if (c.name === 'SecurityHeaders' && url) args.push(`--url=${url}`);

  let result =
    c.name === 'SecurityHeaders'
      ? runNode(c.script, args, { capture: true })
      : runNode(c.script, args);

  if (c.name === 'SecurityHeaders' && result.status !== 0) {
    console.log('[validate:external] WARN: SecurityHeaders fetch path failed, trying Playwright fallback');
    // Cloudflare often blocks plain fetch(). Try browser automation as fallback.
    const fallbackResult = runNode('tools/external/securityheaders-grade-playwright.js', args);
    if (fallbackResult.status === 0) {
      console.log('[validate:external] INFO: SecurityHeaders fallback succeeded');
      result = fallbackResult;
    } else {
      printCapturedOutput(result);
      result = fallbackResult;
    }
  } else if (c.name === 'SecurityHeaders') {
    printCapturedOutput(result);
  }

  if (result.status !== 0) {
    console.error(`[validate:external] FAIL: ${c.name}`);
    failed += 1;
  } else {
    console.log(`[validate:external] OK: ${c.name}`);
  }
}

if (failed > 0) {
  console.error(`[validate:external] ${failed}/${checks.length} checks failed`);
  process.exit(1);
}

console.log('[validate:external] All external checks passed');
