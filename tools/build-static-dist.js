import fs from 'node:fs/promises';
import path from 'node:path';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const publicDir = path.join(root, 'public');
  const distDir = path.join(root, 'dist');
  const rootIndex = path.join(root, 'index.html');
  const distIndex = path.join(distDir, 'index.html');

  if (!(await exists(publicDir))) {
    console.error(`[build] Missing directory: ${publicDir}`);
    process.exit(1);
  }
  if (!(await exists(rootIndex))) {
    console.error(`[build] Missing file: ${rootIndex}`);
    process.exit(1);
  }

  // Clean dist (Firebase hosting target).
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  // 1) Copy /public => /dist
  // 2) Copy root index.html => /dist/index.html (source of truth)
  await fs.cp(publicDir, distDir, { recursive: true });
  await fs.copyFile(rootIndex, distIndex);
  await injectStripePublicKey(distIndex);

  // Never ship local-only private config, even if present in developer machine.
  const forbiddenLocalDevConfig = path.join(distDir, 'js', 'local-dev-config.js');
  await fs.rm(forbiddenLocalDevConfig, { force: true });

  console.log('[build] dist prepared from static assets (public/ + root index.html)');
}

async function injectStripePublicKey(indexPath) {
  const stripePublicKey = String(process.env.WFX_STRIPE_PUBLIC_KEY || '').trim();
  if (!stripePublicKey) return;

  const html = await fs.readFile(indexPath, 'utf8');
  const runtimeConfigRegex =
    /(<script[^>]*id=["']runtime-config["'][^>]*>)([\s\S]*?)(<\/script>)/i;
  const match = html.match(runtimeConfigRegex);
  if (!match) {
    throw new Error('[build] runtime-config script not found in index.html');
  }

  let config;
  try {
    config = JSON.parse(match[2]);
  } catch (error) {
    throw new Error(`[build] runtime-config JSON parse failed: ${error.message}`);
  }

  if (!config.payments || typeof config.payments !== 'object') {
    config.payments = {};
  }
  config.payments.stripePublicKey = stripePublicKey;

  const updatedScript = `${match[1]}\n${JSON.stringify(config, null, 8)}\n${match[3]}`;
  const updatedHtml = html.replace(runtimeConfigRegex, updatedScript);
  await fs.writeFile(indexPath, updatedHtml, 'utf8');
  console.log('[build] injected Stripe public key from WFX_STRIPE_PUBLIC_KEY');
}

await main();
