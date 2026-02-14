import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve('dist', 'assets');
if (!fs.existsSync(distAssetsDir)) {
  console.error('[budget:chunks] dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const MAX_DEFAULT_KB = 130;
const MAX_BOOTSTRAP_KB = 180;
const MAX_INDEX_KB = 220;
const MAX_VENDOR_KB = 260;

const jsFiles = fs
  .readdirSync(distAssetsDir)
  .filter(name => name.endsWith('.js'))
  .map(name => {
    const fullPath = path.join(distAssetsDir, name);
    const sizeKb = fs.statSync(fullPath).size / 1024;
    return { name, sizeKb };
  })
  .sort((a, b) => b.sizeKb - a.sizeKb);

const failures = [];

for (const file of jsFiles) {
  let maxKb = MAX_DEFAULT_KB;
  if (file.name.startsWith('bootstrap-')) maxKb = MAX_BOOTSTRAP_KB;
  if (file.name.startsWith('index-')) maxKb = MAX_INDEX_KB;
  if (file.name.startsWith('vendor-') || file.name === 'vendor.js') maxKb = MAX_VENDOR_KB;

  if (file.sizeKb > maxKb) {
    failures.push(
      `${file.name}: ${file.sizeKb.toFixed(1)} KB (max ${maxKb} KB)`
    );
  }
}

console.log('[budget:chunks] JS chunks found:', jsFiles.length);
for (const file of jsFiles.slice(0, 8)) {
  console.log(` - ${file.name}: ${file.sizeKb.toFixed(1)} KB`);
}

if (failures.length > 0) {
  console.error('\n[budget:chunks] Budget failures:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[budget:chunks] OK');
