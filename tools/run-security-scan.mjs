import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = path.join(process.cwd(), 'tools', 'scan-secrets.ps1');
const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script];

const candidates = process.platform === 'win32' ? ['pwsh', 'powershell'] : ['pwsh', 'powershell'];

for (const command of candidates) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      continue;
    }
    console.error(`Error ejecutando ${command}:`, result.error);
    process.exit(1);
  }
  if (typeof result.status === 'number') {
    process.exit(result.status);
  }
}

console.error('No se pudo encontrar pwsh ni powershell.');
process.exit(1);
