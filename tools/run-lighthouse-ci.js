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

const result = spawnSync(process.execPath, [cliPath, 'autorun', `--config=${configPath}`], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
