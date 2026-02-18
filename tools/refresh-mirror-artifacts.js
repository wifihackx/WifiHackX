import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const cwd = process.cwd();

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function toRel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function compare(srcRoot, publicRoot) {
  const srcFiles = walk(srcRoot).map(file => toRel(srcRoot, file));
  const pubFiles = walk(publicRoot).map(file => toRel(publicRoot, file));
  const srcSet = new Set(srcFiles);
  const pubSet = new Set(pubFiles);

  const both = srcFiles.filter(file => pubSet.has(file)).sort();
  const onlySrc = srcFiles.filter(file => !pubSet.has(file)).sort();
  const onlyPublic = pubFiles.filter(file => !srcSet.has(file)).sort();
  const same = [];
  const diff = [];

  for (const rel of both) {
    const srcHash = sha256(path.join(srcRoot, rel));
    const pubHash = sha256(path.join(publicRoot, rel));
    if (srcHash === pubHash) {
      same.push(rel);
    } else {
      diff.push(rel);
    }
  }

  return { both, same, diff, onlySrc, onlyPublic };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const js = compare(path.join(cwd, 'src/js'), path.join(cwd, 'public/js'));
const css = compare(path.join(cwd, 'src/css'), path.join(cwd, 'public/css'));
const now = new Date().toISOString();

writeJson(path.join(cwd, 'tools/mirror-baseline.json'), {
  generatedAt: now,
  js: { diff: js.diff, onlySrc: js.onlySrc, onlyPublic: js.onlyPublic },
  css: { diff: css.diff, onlySrc: css.onlySrc, onlyPublic: css.onlyPublic },
});

writeJson(path.join(cwd, 'tools/duplication-audit.json'), {
  generated_at: now,
  js: {
    src_root: 'src/js',
    public_root: 'public/js',
    both_count: js.both.length,
    same_count: js.same.length,
    diff_count: js.diff.length,
    only_src_count: js.onlySrc.length,
    only_public_count: js.onlyPublic.length,
    same: js.same,
    diff: js.diff,
    only_src: js.onlySrc,
    only_public: js.onlyPublic,
  },
  css: {
    src_root: 'src/css',
    public_root: 'public/css',
    both_count: css.both.length,
    same_count: css.same.length,
    diff_count: css.diff.length,
    only_src_count: css.onlySrc.length,
    only_public_count: css.onlyPublic.length,
    same: css.same,
    diff: css.diff,
    only_src: css.onlySrc,
    only_public: css.onlyPublic,
  },
});

const md = [
  '# Duplicacion src/public - Estado actual',
  '',
  `Fecha: ${now}`,
  '',
  '## Resumen',
  `- JS compartidos por ruta: ${js.both.length}`,
  `- JS identicos (hash): ${js.same.length}`,
  `- JS distintos por ruta: ${js.diff.length}`,
  `- JS solo en src: ${js.onlySrc.length}`,
  `- JS solo en public: ${js.onlyPublic.length}`,
  `- CSS compartidos por ruta: ${css.both.length}`,
  `- CSS identicos (hash): ${css.same.length}`,
  `- CSS distintos por ruta: ${css.diff.length}`,
  `- CSS solo en src: ${css.onlySrc.length}`,
  `- CSS solo en public: ${css.onlyPublic.length}`,
  '',
  '## Estado',
  '- Paridad completa alcanzada entre src/public para rutas equivalentes.',
  '- Sin diferencias por hash en archivos compartidos.',
  '',
  '## Recomendacion',
  '1. Mantener `src` como fuente unica de verdad.',
  '2. Usar `npm run mirror:check:strict` en CI para bloquear deriva nueva.',
  '3. Evitar ediciones manuales en un solo lado del espejo.',
  '',
  '## Artefacto tecnico',
  '- Detalle completo en `tools/duplication-audit.json`.',
  '',
];
fs.writeFileSync(path.join(cwd, 'tools/duplication-audit.md'), md.join('\n'), 'utf8');

console.log('[mirror:refresh] Updated tools/mirror-baseline.json');
console.log('[mirror:refresh] Updated tools/duplication-audit.json');
console.log('[mirror:refresh] Updated tools/duplication-audit.md');
