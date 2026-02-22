import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public/js');

function walkJsFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      out.push(fullPath);
    }
  }
  return out;
}

function stripQueryAndHash(specifier) {
  return specifier.split('?')[0].split('#')[0];
}

function hasNamedExport(source, name) {
  const patterns = [
    new RegExp(`export\\s+function\\s+${name}\\b`),
    new RegExp(`export\\s+(const|let|var|class)\\s+${name}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`),
  ];
  return patterns.some(re => re.test(source));
}

function parseNamedImports(source) {
  const imports = [];
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(source)) !== null) {
    const names = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.split(/\s+as\s+/)[0].trim())
      .filter(Boolean);

    imports.push({ names, specifier: match[2] });
  }
  return imports;
}

if (!fs.existsSync(root)) {
  console.error(`[check:exports] Missing directory: ${root}`);
  process.exit(1);
}

const jsFiles = walkJsFiles(root);
const issues = [];

for (const filePath of jsFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const namedImports = parseNamedImports(source);

  for (const item of namedImports) {
    if (!item.specifier.startsWith('.')) {
      continue;
    }

    const localSpecifier = stripQueryAndHash(item.specifier);
    const targetPath = path.resolve(path.dirname(filePath), localSpecifier);

    if (!targetPath.startsWith(root)) {
      continue;
    }
    if (!fs.existsSync(targetPath)) {
      continue;
    }

    const targetSource = fs.readFileSync(targetPath, 'utf8');
    for (const name of item.names) {
      if (!hasNamedExport(targetSource, name)) {
        issues.push({
          file: path.relative(process.cwd(), filePath),
          name,
          specifier: item.specifier,
          target: path.relative(process.cwd(), targetPath),
        });
      }
    }
  }
}

if (issues.length > 0) {
  console.error('[check:exports] Missing named exports detected:');
  for (const issue of issues) {
    console.error(
      `- ${issue.file} imports ${issue.name} from ${issue.specifier} but ${issue.target} does not export it`
    );
  }
  process.exit(1);
}

console.log('[check:exports] OK: no missing named exports in local public/js imports.');
