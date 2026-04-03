import fs from 'node:fs';
import path from 'node:path';

const state = { passed: 0, failed: 0 };

function pass(message) {
  state.passed += 1;
  console.log(`[budget:ok] ${message}`);
}

function fail(message) {
  state.failed += 1;
  console.error(`[budget:fail] ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveArg(prefix, fallbackPath) {
  const value = process.argv.find(arg => arg.startsWith(prefix));
  return path.resolve(process.cwd(), value ? value.slice(prefix.length) : fallbackPath);
}

function normalizeResourceType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function formatKiB(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  return `${(bytes / 1024).toFixed(bytes / 1024 < 10 ? 1 : 0)} KiB`;
}

function getRepresentativeRuns(manifest) {
  return manifest.filter(entry => entry && entry.isRepresentativeRun && entry.jsonPath);
}

function getBudgetForPath(budgets, pathname) {
  const pathSpecificBudgets = budgets.filter(budget => {
    if (!budget?.path) return true;
    return String(budget.path).trim() === pathname;
  });

  const explicitBudgets = pathSpecificBudgets.filter(budget => budget?.path);
  if (explicitBudgets.length > 0) {
    return explicitBudgets;
  }

  return pathSpecificBudgets.filter(budget => !budget?.path);
}

function getResourceSummaryByType(lhr) {
  const items = lhr?.audits?.['resource-summary']?.details?.items || [];
  const map = new Map();
  for (const item of items) {
    map.set(normalizeResourceType(item.label), item);
  }
  return map;
}

function main() {
  const manifestPath = resolveArg('--manifest=', path.join('.lighthouseci', 'manifest.json'));
  const budgetsPath = resolveArg('--budgets=', 'lighthouse-budget.json');

  if (!fs.existsSync(manifestPath)) {
    fail(`Missing Lighthouse manifest: ${manifestPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(budgetsPath)) {
    fail(`Missing budgets file: ${budgetsPath}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const budgets = readJson(budgetsPath);
  const representativeRuns = getRepresentativeRuns(manifest);

  if (representativeRuns.length === 0) {
    fail('No representative Lighthouse runs found in manifest');
    process.exit(1);
  }

  for (const entry of representativeRuns) {
    const lhr = readJson(entry.jsonPath);
    const pathname = new URL(entry.url).pathname;
    const matchingBudgets = getBudgetForPath(budgets, pathname);
    const summaryByType = getResourceSummaryByType(lhr);

    if (matchingBudgets.length === 0) {
      pass(`${pathname} has no matching explicit budget block; skipped`);
      continue;
    }

    for (const budget of matchingBudgets) {
      for (const resourceBudget of budget.resourceSizes || []) {
        const resourceType = normalizeResourceType(resourceBudget.resourceType);
        const actual = summaryByType.get(resourceType)?.transferSize || 0;
        const expectedBytes = Number(resourceBudget.budget || 0) * 1024;
        if (actual <= expectedBytes) {
          pass(
            `${pathname} ${resourceType} transfer ${formatKiB(actual)} <= ${formatKiB(expectedBytes)}`
          );
        } else {
          fail(
            `${pathname} ${resourceType} transfer ${formatKiB(actual)} > ${formatKiB(expectedBytes)}`
          );
        }
      }

      for (const countBudget of budget.resourceCounts || []) {
        const resourceType = normalizeResourceType(countBudget.resourceType);
        const actual = summaryByType.get(resourceType)?.requestCount || 0;
        const expectedCount = Number(countBudget.budget || 0);
        if (actual <= expectedCount) {
          pass(`${pathname} ${resourceType} requests ${actual} <= ${expectedCount}`);
        } else {
          fail(`${pathname} ${resourceType} requests ${actual} > ${expectedCount}`);
        }
      }
    }
  }

  console.log(`[budget] passed=${state.passed} failed=${state.failed}`);
  if (state.failed > 0) {
    process.exit(1);
  }
}

main();
