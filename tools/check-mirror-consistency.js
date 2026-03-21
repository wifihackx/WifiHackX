import fs from 'node:fs';
import path from 'node:path';
import { MIRROR_MANAGED_ROOTS, MIRROR_SOURCE_OF_TRUTH } from './mirror-config.js';
import { compareMirrors } from './mirror-shared.js';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const baselinePathArg = process.argv.find(arg => arg.startsWith('--baseline='));
const baselinePath = baselinePathArg
  ? baselinePathArg.split('=')[1]
  : path.join(cwd, 'tools', 'mirror-baseline.json');

function printSection(title, items) {
  console.log(title);
  if (!items.length) {
    console.log('  (none)');
    return;
  }
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function sortArray(items) {
  return [...items].sort();
}

function diffArray(current, expected) {
  const expectedSet = new Set(expected);
  return current.filter(item => !expectedSet.has(item));
}

const comparisons = MIRROR_MANAGED_ROOTS.map(rootConfig => compareMirrors(cwd, rootConfig));

console.log('Mirror consistency report');
console.log(`Source of truth: ${MIRROR_SOURCE_OF_TRUTH}/`);

for (const result of comparisons) {
  if (!result.srcExists) {
    console.log(`[WARN] Missing mirror source root: ${result.srcRoot}`);
  }
  console.log(
    `${result.id.toUpperCase()} both=${result.bothCount} same=${result.sameCount} diff=${result.diffCount} onlySrc=${result.onlySrcCount} onlyPublic=${result.onlyPublicCount} publicOnly=${result.publicOnly.length}`
  );
  if (result.publicOnly.length > 0) {
    console.log(`  publicOnly: ${result.publicOnly.join(', ')}`);
  }
}

if (strict) {
  for (const result of comparisons) {
    printSection(`\n${result.id.toUpperCase()} differing files`, result.diff);
    printSection(`\n${result.id.toUpperCase()} only in src`, result.onlySrc);
    printSection(`\n${result.id.toUpperCase()} only in public`, result.onlyPublic);
  }
}

const hasMirrorDrift = comparisons.some(
  result => result.diffCount > 0 || result.onlySrcCount > 0 || result.onlyPublicCount > 0
);

if (strict) {
  if (!fs.existsSync(baselinePath)) {
    console.error(`[FAIL] Baseline file not found: ${baselinePath}`);
    console.error('Create it from current state before enabling strict enforcement.');
    process.exit(1);
  }

  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (error) {
    console.error(`[FAIL] Invalid baseline JSON: ${error.message}`);
    process.exit(1);
  }

  let hasUnexpected = false;

  for (const result of comparisons) {
    const current = {
      diff: sortArray(result.diff),
      onlySrc: sortArray(result.onlySrc),
      onlyPublic: sortArray(result.onlyPublic),
    };
    const expectedRoot = baseline[result.id] || {};
    const expected = {
      diff: sortArray(expectedRoot.diff || []),
      onlySrc: sortArray(expectedRoot.onlySrc || []),
      onlyPublic: sortArray(expectedRoot.onlyPublic || []),
    };
    const unexpected = {
      diff: diffArray(current.diff, expected.diff),
      onlySrc: diffArray(current.onlySrc, expected.onlySrc),
      onlyPublic: diffArray(current.onlyPublic, expected.onlyPublic),
    };
    const rootHasUnexpected =
      unexpected.diff.length > 0 ||
      unexpected.onlySrc.length > 0 ||
      unexpected.onlyPublic.length > 0;

    if (!rootHasUnexpected) continue;

    hasUnexpected = true;
    console.error(`\n[FAIL] New mirror drift detected against baseline for ${result.id}`);
    printSection(`\nUnexpected ${result.id.toUpperCase()} diff`, unexpected.diff);
    printSection(`\nUnexpected ${result.id.toUpperCase()} only in src`, unexpected.onlySrc);
    printSection(`\nUnexpected ${result.id.toUpperCase()} only in public`, unexpected.onlyPublic);
  }

  if (hasUnexpected) {
    process.exit(1);
  }
} else if (hasMirrorDrift) {
  console.log('\n[WARN] Mirror drift exists (non-strict mode).');
}

console.log('\n[OK] Mirror check completed');
