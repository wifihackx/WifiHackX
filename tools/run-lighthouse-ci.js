import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cliPath = path.join(process.cwd(), 'node_modules', '@lhci', 'cli', 'src', 'cli.js');
const configArg = process.argv.find(arg => arg.startsWith('--config='));
const configPath = configArg ? configArg.slice('--config='.length) : './lighthouserc.json';

if (!fs.existsSync(cliPath)) {
  console.error('[lighthouse:ci] Missing local dependency: @lhci/cli');
  console.error('[lighthouse:ci] Install it with: npm i -D @lhci/cli');
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error(`[lighthouse:ci] Missing Lighthouse config: ${configPath}`);
  process.exit(1);
}

function findPlaywrightChrome() {
  const roots = [];
  if (process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, 'ms-playwright'));
  }
  if (process.env.USERPROFILE) {
    roots.push(path.join(process.env.USERPROFILE, 'AppData', 'Local', 'ms-playwright'));
  }

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse();

    for (const entryName of entries) {
      const candidates = [
        path.join(root, entryName, 'chrome-win', 'chrome.exe'),
        path.join(root, entryName, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
      ];
      const found = candidates.find(candidate => fs.existsSync(candidate));
      if (found) return found;
    }
  }

  return '';
}

const env = { ...process.env };
if (!env.CHROME_PATH || !fs.existsSync(env.CHROME_PATH)) {
  const playwrightChrome = findPlaywrightChrome();
  if (playwrightChrome) {
    env.CHROME_PATH = playwrightChrome;
    console.log(`[lighthouse:ci] Using Playwright Chrome from ${playwrightChrome}`);
  }
}

const result = spawnSync(process.execPath, [cliPath, 'autorun', `--config=${configPath}`], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
