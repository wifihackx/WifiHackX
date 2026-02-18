#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node tools/firebase-cli.js <firebase args...>');
  process.exit(1);
}

const env = { ...process.env };
const currentNodeOptions =
  typeof env.NODE_OPTIONS === 'string' ? env.NODE_OPTIONS : '';
if (!currentNodeOptions.includes('--no-deprecation')) {
  env.NODE_OPTIONS = `${currentNodeOptions} --no-deprecation`.trim();
}

const bin = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const child = spawn(bin, args, {
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('error', error => {
  console.error('[firebase-cli-wrapper] Failed to start firebase CLI:', error.message);
  process.exit(1);
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
