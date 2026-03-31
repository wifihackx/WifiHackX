import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = path.join(process.cwd(), 'tools', 'scan-secrets.ps1');
const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script];
const frontendAudit = path.join(process.cwd(), 'tools', 'audit-frontend-dom-safety.mjs');

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) {
    return result;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
  return result;
}

const candidates = process.platform === 'win32' ? ['pwsh', 'powershell'] : ['pwsh', 'powershell'];

for (const command of candidates) {
  const result = runCommand(command, args);
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      continue;
    }
    console.error(`Error ejecutando ${command}:`, result.error);
    process.exit(1);
  }
  if (typeof result.status === 'number') {
    runCommand(process.execPath, [frontendAudit]);
    process.exit(0);
  }
}

console.error('No se pudo encontrar pwsh ni powershell.');
process.exit(1);
