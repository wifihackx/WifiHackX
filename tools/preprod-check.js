import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function runNode(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  return result.status ?? 1;
}

function ensureFile(filePath, label) {
  if (fs.existsSync(filePath)) return true;
  console.error(`[preprod] Missing ${label}: ${filePath}`);
  return false;
}

function buildDist() {
  const buildScript = 'tools/build-static-dist.js';
  if (!ensureFile(buildScript, 'build script')) return 1;

  // 1) Build dist from static assets.
  const buildStatus = runNode([buildScript]);
  if (buildStatus !== 0) return buildStatus;

  // 2) Minify dist/index.html post-build (keeps budgets stable).
  return runNode(['tools/minify-dist-html.js']);
}

console.log('[preprod] Starting pre-production checks');

const buildStatus = buildDist();
if (buildStatus !== 0) process.exit(buildStatus);

const distStatus = runNode(['tools/validate-dist.js']);
if (distStatus !== 0) process.exit(distStatus);

const sprint5Status = runNode(['tools/validate-sprint5.js']);
if (sprint5Status !== 0) process.exit(sprint5Status);

const lhStatus = runNode(['tools/run-lighthouse-ci.js']);
process.exit(lhStatus);
