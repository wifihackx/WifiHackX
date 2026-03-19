#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targets = process.argv.slice(2);
const resolvedTargets = (targets.length > 0 ? targets : ['dist']).map(target =>
  path.resolve(repoRoot, target)
);

for (const target of resolvedTargets) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`[clean] removed ${path.relative(repoRoot, target) || '.'}`);
  } catch (error) {
    console.error(`[clean] failed to remove ${target}:`, error.message);
    process.exitCode = 1;
  }
}
