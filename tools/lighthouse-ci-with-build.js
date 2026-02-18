import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runNode(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit', env: process.env });
  return result.status ?? 1;
}

async function runBuildWithRetry(maxAttempts = 3) {
  const buildScript = 'tools/build-static-dist.js';
  if (!fs.existsSync(buildScript)) {
    console.error('[lighthouse:ci] Missing build script: tools/build-static-dist.js');
    return 1;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = runNode(buildScript);
    if (status === 0) {
      // Keep dist/index.html minified to keep budgets stable.
      const minifyStatus = runNode('tools/minify-dist-html.js');
      return minifyStatus;
    }

    if (attempt < maxAttempts) {
      console.warn(`[lighthouse:ci] build failed (attempt ${attempt}/${maxAttempts}). Retrying...`);
      await sleep(1500);
      continue;
    }

    return status;
  }

  return 1;
}

const buildStatus = await runBuildWithRetry(3);
if (buildStatus !== 0) process.exit(buildStatus);

const lhStatus = runNode('tools/run-lighthouse-ci.js');
process.exit(lhStatus);
