#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

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

const cmd =
  'firebase emulators:exec --only firestore --project demo-wifihackx-rules "vitest run tests/rules/firestore.rules.test.js"';

const child = spawn(cmd, {
  stdio: 'inherit',
  shell: true,
  env: withNodeOptions(withJavaEnv(process.env)),
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
