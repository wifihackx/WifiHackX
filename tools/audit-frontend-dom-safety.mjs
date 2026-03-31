import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const baselinePath = path.join(root, 'tools', 'frontend-dom-safety-baseline.json');

const scans = [
  {
    key: 'dynamicSelectors',
    label: 'Dynamic selectors',
    pattern: /querySelector\([^\n]*\$\{|querySelectorAll\([^\n]*\$\{/g,
  },
  {
    key: 'dynamicAttributeTemplates',
    label: 'Dynamic attribute templates',
    pattern:
      /data-[a-zA-Z-]+="\$\{|href="\$\{|src="\$\{|alt="\$\{|title="\$\{|aria-label="\$\{/g,
  },
  {
    key: 'dynamicInnerHtmlTemplates',
    label: 'Template innerHTML assignments',
    pattern: /innerHTML\s*=\s*`/g,
  },
];

function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath).replace(/\//g, '\\');
    if (entry.isDirectory()) {
      if (relativePath.startsWith('src\\js\\vendor')) continue;
      files.push(...collectJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findMatches(pattern) {
  const files = collectJsFiles(path.join(root, 'src', 'js'));
  const matches = [];

  for (const file of files) {
    const relativeFile = path.relative(root, file).replace(/\//g, '\\');
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${relativeFile}:${index + 1}:${line}`);
      }
      pattern.lastIndex = 0;
    });
  }

  return matches;
}

function printBlock(prefix, values) {
  values.forEach(value => console.log(`${prefix} ${value}`));
}

function main() {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const errors = [];
  const warnings = [];

  console.log('== Frontend DOM Safety Audit ==');

  for (const scan of scans) {
    const current = findMatches(scan.pattern);
    const expected = Array.isArray(baseline[scan.key]) ? baseline[scan.key] : [];
    const expectedSet = new Set(expected);
    const currentSet = new Set(current);

    const unexpected = current.filter(item => !expectedSet.has(item));
    const missing = expected.filter(item => !currentSet.has(item));

    if (unexpected.length > 0) {
      errors.push(scan.label);
      console.error(`[FAIL] ${scan.label}: se detectaron patrones nuevos no auditados.`);
      printBlock('  +', unexpected);
    } else {
      console.log(`[PASS] ${scan.label}: sin patrones nuevos.`);
    }

    if (missing.length > 0) {
      warnings.push(scan.label);
      console.warn(`[WARN] ${scan.label}: la baseline contiene entradas ya desaparecidas.`);
      printBlock('  -', missing);
    }
  }

  console.log('');
  console.log(`Resumen: ${errors.length} error(es), ${warnings.length} warning(s).`);
  console.log(
    '[INFO] Si un cambio es intencional y seguro, actualiza tools/frontend-dom-safety-baseline.json.'
  );

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
