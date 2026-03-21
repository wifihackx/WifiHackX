import { syncManagedMirrorRoots, summarizeMirrorResults } from './mirror-shared.js';

const cwd = process.cwd();
const results = syncManagedMirrorRoots(cwd);

for (const result of results) {
  console.log(
    `[mirror:sync] ${result.id} copied=${result.copied.length} deleted=${result.deleted.length} publicOnly=${result.publicOnly.join(', ') || '(none)'}`
  );
}

console.log(`[mirror:sync] ${summarizeMirrorResults(results)}`);
