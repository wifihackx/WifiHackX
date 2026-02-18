import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const baselinePathArg = process.argv.find(arg => arg.startsWith('--baseline='));
const baselinePath = baselinePathArg
  ? baselinePathArg.split('=')[1]
  : path.join(cwd, 'tools', 'mirror-baseline.json');

function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
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

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeJsContent(text) {
  let out = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  out = out.replace(
    /(^|\n)[ \t]*export[ \t]*\{[\s\S]*?\};?[ \t]*(?=\n|$)/g,
    '$1'
  );
  out = out.replace(/\bexport[ \t]+(?=function\b|\{)/g, '');
  out = out
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  out = out.replace(/\n\s*\n+/g, '\n');
  return out.trim();
}

function normalizeCssContent(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
}

function hashNormalizedFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let normalized = content;
  if (relPath.endsWith('.js')) {
    normalized = normalizeJsContent(content);
  } else if (relPath.endsWith('.css')) {
    normalized = normalizeCssContent(content);
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function toRel(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function compareMirrors(srcRoot, publicRoot) {
  const srcFiles = walkFiles(srcRoot).map(f => toRel(srcRoot, f));
  const pubFiles = walkFiles(publicRoot).map(f => toRel(publicRoot, f));

  const srcSet = new Set(srcFiles);
  const pubSet = new Set(pubFiles);
  const both = srcFiles.filter(f => pubSet.has(f));
  const onlySrc = srcFiles.filter(f => !pubSet.has(f)).sort();
  const onlyPublic = pubFiles.filter(f => !srcSet.has(f)).sort();
  const same = [];
  const diff = [];

  for (const rel of both) {
    const srcHash = hashNormalizedFile(path.join(srcRoot, rel), rel);
    const pubHash = hashNormalizedFile(path.join(publicRoot, rel), rel);
    if (srcHash === pubHash) {
      same.push(rel);
    } else {
      diff.push(rel);
    }
  }

  return {
    srcRoot: path.relative(cwd, srcRoot).replace(/\\/g, '/'),
    publicRoot: path.relative(cwd, publicRoot).replace(/\\/g, '/'),
    bothCount: both.length,
    sameCount: same.length,
    diffCount: diff.length,
    onlySrcCount: onlySrc.length,
    onlyPublicCount: onlyPublic.length,
    diff: diff.sort(),
    onlySrc,
    onlyPublic,
  };
}

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

const js = compareMirrors(path.join(cwd, 'src/js'), path.join(cwd, 'public/js'));
const css = compareMirrors(path.join(cwd, 'src/css'), path.join(cwd, 'public/css'));

console.log('Mirror consistency report');
console.log(
  `JS  both=${js.bothCount} same=${js.sameCount} diff=${js.diffCount} onlySrc=${js.onlySrcCount} onlyPublic=${js.onlyPublicCount}`
);
console.log(
  `CSS both=${css.bothCount} same=${css.sameCount} diff=${css.diffCount} onlySrc=${css.onlySrcCount} onlyPublic=${css.onlyPublicCount}`
);

if (strict) {
  printSection('\nJS differing files', js.diff);
  printSection('\nJS only in src', js.onlySrc);
  printSection('\nJS only in public', js.onlyPublic);
  printSection('\nCSS differing files', css.diff);
  printSection('\nCSS only in src', css.onlySrc);
  printSection('\nCSS only in public', css.onlyPublic);
}

const hasMirrorDrift =
  js.diffCount > 0 ||
  js.onlySrcCount > 0 ||
  js.onlyPublicCount > 0 ||
  css.diffCount > 0 ||
  css.onlySrcCount > 0 ||
  css.onlyPublicCount > 0;

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

  const current = {
    js: {
      diff: sortArray(js.diff),
      onlySrc: sortArray(js.onlySrc),
      onlyPublic: sortArray(js.onlyPublic),
    },
    css: {
      diff: sortArray(css.diff),
      onlySrc: sortArray(css.onlySrc),
      onlyPublic: sortArray(css.onlyPublic),
    },
  };

  const expected = {
    js: {
      diff: sortArray((baseline.js && baseline.js.diff) || []),
      onlySrc: sortArray((baseline.js && baseline.js.onlySrc) || []),
      onlyPublic: sortArray((baseline.js && baseline.js.onlyPublic) || []),
    },
    css: {
      diff: sortArray((baseline.css && baseline.css.diff) || []),
      onlySrc: sortArray((baseline.css && baseline.css.onlySrc) || []),
      onlyPublic: sortArray((baseline.css && baseline.css.onlyPublic) || []),
    },
  };

  const unexpected = {
    js: {
      diff: diffArray(current.js.diff, expected.js.diff),
      onlySrc: diffArray(current.js.onlySrc, expected.js.onlySrc),
      onlyPublic: diffArray(current.js.onlyPublic, expected.js.onlyPublic),
    },
    css: {
      diff: diffArray(current.css.diff, expected.css.diff),
      onlySrc: diffArray(current.css.onlySrc, expected.css.onlySrc),
      onlyPublic: diffArray(current.css.onlyPublic, expected.css.onlyPublic),
    },
  };

  const hasUnexpected =
    unexpected.js.diff.length > 0 ||
    unexpected.js.onlySrc.length > 0 ||
    unexpected.js.onlyPublic.length > 0 ||
    unexpected.css.diff.length > 0 ||
    unexpected.css.onlySrc.length > 0 ||
    unexpected.css.onlyPublic.length > 0;

  if (hasUnexpected) {
    console.error('\n[FAIL] New mirror drift detected against baseline');
    printSection('\nUnexpected JS diff', unexpected.js.diff);
    printSection('\nUnexpected JS only in src', unexpected.js.onlySrc);
    printSection('\nUnexpected JS only in public', unexpected.js.onlyPublic);
    printSection('\nUnexpected CSS diff', unexpected.css.diff);
    printSection('\nUnexpected CSS only in src', unexpected.css.onlySrc);
    printSection('\nUnexpected CSS only in public', unexpected.css.onlyPublic);
    process.exit(1);
  }
} else if (hasMirrorDrift) {
  console.log('\n[WARN] Mirror drift exists (non-strict mode).');
}

console.log('\n[OK] Mirror check completed');
