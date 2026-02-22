#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const DEFAULT_RULES_TEST_FILE = path.join('tests', 'rules', 'firestore.rules.test.js');
const VITEST_SETUP_FILE = path.join('tests', 'setup.js');
const requestedTestFile = process.argv[2] || DEFAULT_RULES_TEST_FILE;

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
    candidates.push(...discoverWindowsJavaHomes());
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

function discoverWindowsJavaHomes() {
  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\OpenJDK',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\Amazon Corretto'
  ];
  const homes = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    try {
      const entries = readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(root, entry.name))
        .sort()
        .reverse();

      homes.push(...entries);
    } catch {
      // Ignore unreadable directories.
    }
  }

  return homes;
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

function validateRequiredFiles() {
  const missingFiles = [];

  if (!existsSync(requestedTestFile)) {
    missingFiles.push(requestedTestFile);
  }

  if (!existsSync(VITEST_SETUP_FILE)) {
    missingFiles.push(VITEST_SETUP_FILE);
  }

  if (missingFiles.length > 0) {
    console.error('Error: Missing required test files for Firestore rules suite.');
    for (const file of missingFiles) {
      console.error(`  - ${file}`);
    }
    console.error(
      'Solution: restore these files or update vitest.config.js and tools/run-firestore-rules-tests.js to match your test layout.'
    );
    process.exit(1);
  }
}

validateRequiredFiles();
const firebaseCli = resolveFirebaseBin();
const vitestCommand = `"${process.execPath}" "./node_modules/vitest/vitest.mjs" run ${requestedTestFile}`;

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
