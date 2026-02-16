import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cliPath = path.join(process.cwd(), 'node_modules', '@lhci', 'cli', 'src', 'cli.js');
const configPath = process.env.LIGHTHOUSE_RC || './lighthouserc.json';

if (!fs.existsSync(cliPath)) {
  console.error('[lighthouse:ci] Missing local dependency: @lhci/cli');
  console.error('[lighthouse:ci] Install it with: npm i -D @lhci/cli');
  process.exit(1);
}

if (!fs.existsSync(path.resolve(process.cwd(), configPath))) {
  console.error(`[lighthouse:ci] Missing config file: ${configPath}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cliPath, 'autorun', `--config=${configPath}`],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
