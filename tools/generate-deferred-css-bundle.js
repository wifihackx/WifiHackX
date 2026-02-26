import fs from 'node:fs/promises';
import path from 'node:path';

const BUNDLE_FILES = [
  'main.css',
  'cookie-consent.css',
  'announcements-bundle.css',
  'announcement-description.css',
  'announcement-modal.css',
  'share-button.css',
];

async function buildBundle(rootDir, cssDir) {
  const header = '/* Auto-generated deferred CSS bundle. Do not edit directly. */\n';
  let output = header;

  for (const file of BUNDLE_FILES) {
    const filePath = path.join(rootDir, cssDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    output += `\n/* ---- ${file} ---- */\n`;
    output += content;
    if (!output.endsWith('\n')) output += '\n';
  }

  const outPath = path.join(rootDir, cssDir, 'app-deferred.css');
  await fs.writeFile(outPath, output, 'utf8');
  return outPath;
}

async function main() {
  const root = process.cwd();
  const targets = ['src/css', 'public/css'];
  for (const cssDir of targets) {
    const outPath = await buildBundle(root, cssDir);
    console.log(`[deferred-css] generated ${outPath}`);
  }
}

main().catch(error => {
  console.error('[deferred-css] failed:', error);
  process.exit(1);
});
