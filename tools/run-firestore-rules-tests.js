#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const rulesPath = path.join(repoRoot, 'firestore.rules');

if (!fs.existsSync(rulesPath)) {
  console.error('[test:rules] firestore.rules not found');
  process.exit(1);
}

const customTestPath = process.argv[2];
if (customTestPath) {
  const resolved = path.resolve(repoRoot, customTestPath);
  if (!fs.existsSync(resolved)) {
    console.error(`[test:rules] requested test file not found: ${customTestPath}`);
    process.exit(1);
  }
}

const rulesContent = fs.readFileSync(rulesPath, 'utf8');
if (!rulesContent.includes('match /customers/{userId}')) {
  console.error('[test:rules] expected customers rules block not found');
  process.exit(1);
}

console.log('[test:rules] firestore.rules sanity checks passed');
