import { spawnSync } from 'node:child_process';
import { MIRROR_MANAGED_ROOTS, toPosixPath } from './mirror-config.js';
import { compareMirrors } from './mirror-shared.js';

const cwd = process.cwd();

function runGitStatus() {
  const result = spawnSync(
    'git',
    [
      'status',
      '--short',
      '--untracked-files=all',
      '--',
      'src/js',
      'public/js',
      'src/css',
      'public/css',
    ],
    { cwd, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    throw new Error(stderr || 'git status failed');
  }
  return String(result.stdout || '');
}

function parseGitStatus(output) {
  const changed = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const normalized = toPosixPath(line.slice(3).trim());
    if (!normalized) continue;
    if (normalized.includes(' -> ')) {
      const [, nextPath] = normalized.split(' -> ');
      changed.add(nextPath.trim());
      continue;
    }
    changed.add(normalized);
  }
  return changed;
}

function getRootConfigForPublicFile(relPath) {
  return (
    MIRROR_MANAGED_ROOTS.find(rootConfig => {
      const prefix = `${toPosixPath(rootConfig.publicDir)}/`;
      if (!relPath.startsWith(prefix)) return false;
      const relative = relPath.slice(prefix.length);
      return !rootConfig.publicOnly.includes(relative);
    }) || null
  );
}

function main() {
  const changed = parseGitStatus(runGitStatus());
  const comparisonById = new Map(
    MIRROR_MANAGED_ROOTS.map(rootConfig => [rootConfig.id, compareMirrors(cwd, rootConfig)])
  );
  const offenders = [];

  for (const filePath of changed) {
    const rootConfig = getRootConfigForPublicFile(filePath);
    if (!rootConfig) continue;
    const publicPrefix = `${toPosixPath(rootConfig.publicDir)}/`;
    const sourcePrefix = `${toPosixPath(rootConfig.sourceDir)}/`;
    const rel = filePath.slice(publicPrefix.length);
    const sourcePath = `${sourcePrefix}${rel}`;
    const comparison = comparisonById.get(rootConfig.id);
    const isCurrentlyInSync = comparison ? !comparison.diff.includes(rel) : false;
    if (!changed.has(sourcePath) && !isCurrentlyInSync) {
      offenders.push({
        publicPath: filePath,
        sourcePath,
      });
    }
  }

  if (offenders.length > 0) {
    console.error('[mirror:guard] Public mirror files changed without matching src edits.');
    for (const offender of offenders) {
      console.error(`  - ${offender.publicPath}`);
      console.error(`    edit ${offender.sourcePath} and run npm run mirror:sync`);
    }
    process.exit(1);
  }

  console.log('[mirror:guard] OK');
}

main();
