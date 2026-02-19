#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';

function withJavaEnv(baseEnv) {
  const env = { ...baseEnv };
  const sep = isWindows ? ';' : ':';

  const candidates = [];
  if (env.JAVA_HOME) {
    candidates.push(env.JAVA_HOME);
  }
  if (isWindows) {
    candidates.push('C:\\Program Files\\OpenJDK\\jdk-21');
    candidates.push('C:\\Program Files\\Java\\jdk-21');
  }

  for (const home of candidates) {
    const bin = isWindows ? `${home}\\bin` : `${home}/bin`;
    const javaExe = isWindows ? `${bin}\\java.exe` : `${bin}/java`;
    if (existsSync(javaExe)) {
      env.JAVA_HOME = home;
      env.PATH = `${bin}${sep}${env.PATH || ''}`;
      break;
    }
  }

  return env;
}

function withNodeOptions(baseEnv) {
  const env = { ...baseEnv };
  const current = typeof env.NODE_OPTIONS === 'string' ? env.NODE_OPTIONS : '';
  if (!current.includes('--no-deprecation')) {
    env.NODE_OPTIONS = `${current} --no-deprecation`.trim();
  }
  return env;
}

function resolveFirebaseBin() {
  const isWin = process.platform === 'win32';
  const localCliJs = path.join(
    process.cwd(),
    'node_modules',
    'firebase-tools',
    'lib',
    'bin',
    'firebase.js'
  );
  if (existsSync(localCliJs)) return { type: 'node-script', value: localCliJs };

  if (isWin) {
    const appData = process.env.APPDATA || '';
    const globalCliJs = appData
      ? path.join(appData, 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')
      : '';
    if (globalCliJs && existsSync(globalCliJs)) {
      return { type: 'node-script', value: globalCliJs };
    }
  }

  const localBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    isWin ? 'firebase.cmd' : 'firebase'
  );
  if (existsSync(localBin)) return { type: 'bin', value: localBin };

  if (isWin) {
    const appData = process.env.APPDATA || '';
    const npmGlobalBin = appData
      ? path.join(appData, 'npm', 'firebase.cmd')
      : '';
    if (npmGlobalBin && existsSync(npmGlobalBin)) return { type: 'bin', value: npmGlobalBin };
  }

  return { type: 'bin', value: isWin ? 'firebase.cmd' : 'firebase' };
}

const firebaseCli = resolveFirebaseBin();
const vitestCommand = `"${process.execPath}" "./node_modules/vitest/vitest.mjs" run tests/rules/firestore.rules.test.js`;

const firebaseArgs = [
  'emulators:exec',
  '--only',
  'firestore',
  '--project',
  'demo-wifihackx-rules',
  vitestCommand,
];

const env = withNodeOptions(withJavaEnv(process.env));
let child;
if (firebaseCli.type === 'node-script') {
  child = spawn(process.execPath, [firebaseCli.value, ...firebaseArgs], {
    stdio: 'inherit',
    shell: false,
    env,
  });
} else if (isWindows && firebaseCli.value.toLowerCase().endsWith('.cmd')) {
  const cmdLine = `"${firebaseCli.value}" emulators:exec --only firestore --project demo-wifihackx-rules ${vitestCommand}`;
  child = spawn(cmdLine, {
    stdio: 'inherit',
    shell: true,
    env,
  });
} else {
  child = spawn(firebaseCli.value, firebaseArgs, {
    stdio: 'inherit',
    shell: false,
    env,
  });
}

child.on('exit', code => {
  process.exit(code ?? 1);
});
