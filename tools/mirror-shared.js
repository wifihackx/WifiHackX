import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MIRROR_MANAGED_ROOTS, MIRROR_SOURCE_OF_TRUTH, toPosixPath } from './mirror-config.js';

export function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return [];
  }
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

export function toRel(rootDir, filePath) {
  return toPosixPath(path.relative(rootDir, filePath));
}

export function normalizeJsContent(text) {
  let out = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  out = out.replace(/(^|\n)[ \t]*export[ \t]*\{[\s\S]*?\};?[ \t]*(?=\n|$)/g, '$1');
  out = out.replace(/\bexport[ \t]+(?=function\b|\{)/g, '');
  out = out
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  out = out.replace(/\n\s*\n+/g, '\n');
  return out.trim();
}

export function normalizeCssContent(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
}

export function hashNormalizedFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let normalized = content;
  if (relPath.endsWith('.js')) {
    normalized = normalizeJsContent(content);
  } else if (relPath.endsWith('.css')) {
    normalized = normalizeCssContent(content);
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function shouldIgnoreMirrorRel(rootConfig, relPath) {
  return rootConfig.publicOnly.includes(relPath);
}

export function compareMirrors(cwd, rootConfig) {
  const srcRoot = path.join(cwd, rootConfig.sourceDir);
  const publicRoot = path.join(cwd, rootConfig.publicDir);
  const srcExists = fs.existsSync(srcRoot) && fs.statSync(srcRoot).isDirectory();
  const publicExists = fs.existsSync(publicRoot) && fs.statSync(publicRoot).isDirectory();

  const srcFiles = walkFiles(srcRoot)
    .map(filePath => toRel(srcRoot, filePath))
    .filter(rel => !shouldIgnoreMirrorRel(rootConfig, rel));
  const publicFiles = walkFiles(publicRoot)
    .map(filePath => toRel(publicRoot, filePath))
    .filter(rel => !shouldIgnoreMirrorRel(rootConfig, rel));

  const srcSet = new Set(srcFiles);
  const publicSet = new Set(publicFiles);
  const both = srcFiles.filter(rel => publicSet.has(rel));
  const onlySrc = srcFiles.filter(rel => !publicSet.has(rel)).sort();
  const onlyPublic = publicFiles.filter(rel => !srcSet.has(rel)).sort();
  const same = [];
  const diff = [];

  for (const rel of both) {
    const srcHash = hashNormalizedFile(path.join(srcRoot, rel), rel);
    const publicHash = hashNormalizedFile(path.join(publicRoot, rel), rel);
    if (srcHash === publicHash) {
      same.push(rel);
    } else {
      diff.push(rel);
    }
  }

  return {
    id: rootConfig.id,
    sourceOfTruth: MIRROR_SOURCE_OF_TRUTH,
    srcRoot: toPosixPath(rootConfig.sourceDir),
    publicRoot: toPosixPath(rootConfig.publicDir),
    srcExists,
    publicExists,
    publicOnly: [...rootConfig.publicOnly].sort(),
    bothCount: both.length,
    sameCount: same.length,
    diffCount: diff.length,
    onlySrcCount: onlySrc.length,
    onlyPublicCount: onlyPublic.length,
    same: same.sort(),
    diff: diff.sort(),
    onlySrc,
    onlyPublic,
  };
}

export function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function syncMirrorRoot(cwd, rootConfig) {
  const srcRoot = path.join(cwd, rootConfig.sourceDir);
  const publicRoot = path.join(cwd, rootConfig.publicDir);
  const copied = [];
  const deleted = [];

  if (!fs.existsSync(srcRoot) || !fs.statSync(srcRoot).isDirectory()) {
    throw new Error(`[mirror:sync] Missing source directory: ${rootConfig.sourceDir}`);
  }

  fs.mkdirSync(publicRoot, { recursive: true });

  const srcFiles = walkFiles(srcRoot).map(filePath => toRel(srcRoot, filePath));
  const publicFiles = walkFiles(publicRoot)
    .map(filePath => toRel(publicRoot, filePath))
    .filter(rel => !shouldIgnoreMirrorRel(rootConfig, rel));
  const srcSet = new Set(srcFiles);

  for (const rel of srcFiles) {
    const srcPath = path.join(srcRoot, rel);
    const publicPath = path.join(publicRoot, rel);
    const srcBuffer = fs.readFileSync(srcPath);
    const publicExists = fs.existsSync(publicPath) && fs.statSync(publicPath).isFile();
    const publicBuffer = publicExists ? fs.readFileSync(publicPath) : null;
    if (!publicExists || !srcBuffer.equals(publicBuffer)) {
      ensureDirForFile(publicPath);
      fs.writeFileSync(publicPath, srcBuffer);
      copied.push(rel);
    }
  }

  for (const rel of publicFiles) {
    if (srcSet.has(rel)) continue;
    const publicPath = path.join(publicRoot, rel);
    fs.rmSync(publicPath, { force: true });
    deleted.push(rel);
  }

  return {
    id: rootConfig.id,
    copied: copied.sort(),
    deleted: deleted.sort(),
    publicOnly: [...rootConfig.publicOnly].sort(),
  };
}

export function syncManagedMirrorRoots(cwd) {
  return MIRROR_MANAGED_ROOTS.map(rootConfig => syncMirrorRoot(cwd, rootConfig));
}

export function summarizeMirrorResults(results) {
  return results
    .map(
      result =>
        `${result.id}: copied=${result.copied.length} deleted=${result.deleted.length} publicOnly=${result.publicOnly.length}`
    )
    .join(' | ');
}
