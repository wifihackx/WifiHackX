import fs from 'node:fs';
import path from 'node:path';
import { MIRROR_BATCHES, MIRROR_MANAGED_ROOTS, MIRROR_SOURCE_OF_TRUTH } from './mirror-config.js';
import { compareMirrors, syncManagedMirrorRoots, summarizeMirrorResults } from './mirror-shared.js';

const cwd = process.cwd();

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const syncResults = syncManagedMirrorRoots(cwd);
const comparisons = MIRROR_MANAGED_ROOTS.map(rootConfig => compareMirrors(cwd, rootConfig));
const now = new Date().toISOString();

const baseline = {
  generatedAt: now,
};

for (const result of comparisons) {
  baseline[result.id] = {
    diff: result.diff,
    onlySrc: result.onlySrc,
    onlyPublic: result.onlyPublic,
  };
}

writeJson(path.join(cwd, 'tools/mirror-baseline.json'), baseline);

const audit = {
  generated_at: now,
  source_of_truth: MIRROR_SOURCE_OF_TRUTH,
  sync_summary: summarizeMirrorResults(syncResults),
  roots: {},
  batches: MIRROR_BATCHES,
};

for (const result of comparisons) {
  audit.roots[result.id] = {
    source_root: result.srcRoot,
    public_root: result.publicRoot,
    src_exists: result.srcExists,
    public_exists: result.publicExists,
    public_only: result.publicOnly,
    both_count: result.bothCount,
    same_count: result.sameCount,
    diff_count: result.diffCount,
    only_src_count: result.onlySrcCount,
    only_public_count: result.onlyPublicCount,
    same: result.same,
    diff: result.diff,
    only_src: result.onlySrc,
    only_public: result.onlyPublic,
  };
}

writeJson(path.join(cwd, 'tools/duplication-audit.json'), audit);

const md = [
  '# Duplicacion src/public - Estado actual',
  '',
  `Fecha: ${now}`,
  '',
  '## Politica',
  `- Fuente unica de verdad: \`${MIRROR_SOURCE_OF_TRUTH}/\``,
  '- `public/` se trata como artefacto sincronizado para `js` y `css`.',
  '- Excepciones explicitas por root:',
  ...comparisons.map(
    result =>
      `  - ${result.id}: ${result.publicOnly.length ? result.publicOnly.join(', ') : '(sin excepciones)'}`
  ),
  '',
  '## Sync',
  `- Resumen: ${summarizeMirrorResults(syncResults)}`,
  '',
  '## Resumen',
  ...comparisons.flatMap(result => [
    `- ${result.id.toUpperCase()} compartidos por ruta: ${result.bothCount}`,
    `- ${result.id.toUpperCase()} identicos (hash normalizado): ${result.sameCount}`,
    `- ${result.id.toUpperCase()} distintos por ruta: ${result.diffCount}`,
    `- ${result.id.toUpperCase()} solo en src: ${result.onlySrcCount}`,
    `- ${result.id.toUpperCase()} solo en public: ${result.onlyPublicCount}`,
  ]),
  '',
  '## Lotes activos',
  ...MIRROR_BATCHES.map(batch => `- ${batch.label} [${batch.status}]: ${batch.files.join(', ')}`),
  '',
  '## Guardas activas',
  '- `npm run mirror:sync` sincroniza `src -> public`.',
  '- `npm run mirror:guard` falla si se edita un espejo en `public/` sin tocar su fuente en `src/`.',
  '- `npm run mirror:check:strict` bloquea deriva nueva en CI.',
  '',
  '## Artefactos',
  '- Detalle completo en `tools/duplication-audit.json`.',
  '- Baseline estricta en `tools/mirror-baseline.json`.',
  '',
];
fs.writeFileSync(path.join(cwd, 'tools/duplication-audit.md'), md.join('\n'), 'utf8');

console.log(`[mirror:refresh] ${summarizeMirrorResults(syncResults)}`);
console.log('[mirror:refresh] Updated tools/mirror-baseline.json');
console.log('[mirror:refresh] Updated tools/duplication-audit.json');
console.log('[mirror:refresh] Updated tools/duplication-audit.md');
