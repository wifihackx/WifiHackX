import fs from 'node:fs/promises';
import path from 'node:path';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const publicDir = path.join(root, 'public');
  const distDir = path.join(root, 'dist');
  const rootIndex = path.join(root, 'index.html');
  const distIndex = path.join(distDir, 'index.html');

  if (!(await exists(publicDir))) {
    console.error(`[build] Missing directory: ${publicDir}`);
    process.exit(1);
  }
  if (!(await exists(rootIndex))) {
    console.error(`[build] Missing file: ${rootIndex}`);
    process.exit(1);
  }

  // Clean dist (Firebase hosting target).
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  // 1) Copy /public => /dist
  // 2) Copy root index.html => /dist/index.html (source of truth)
  await fs.cp(publicDir, distDir, { recursive: true });
  await fs.copyFile(rootIndex, distIndex);

  console.log('[build] dist prepared from static assets (public/ + root index.html)');
}

await main();

