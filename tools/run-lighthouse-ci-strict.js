import { spawnSync } from 'node:child_process';

const env = { ...process.env, LIGHTHOUSE_RC: './lighthouserc.strict.json' };
const result = spawnSync(process.execPath, ['tools/run-lighthouse-ci.js'], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
