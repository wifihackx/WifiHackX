import fs from 'node:fs';
import path from 'node:path';

const LEGACY_FALLBACK_URL = 'https://wifihackx.com';

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function inferBaseUrl(cwd = process.cwd()) {
  const envUrl = process.env.SITE_URL || process.env.SPRINT5_TARGET_URL;
  if (envUrl) return normalizeUrl(envUrl);

  const firebasePath = path.join(cwd, 'firebase.json');
  if (fs.existsSync(firebasePath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
      const site = firebaseConfig?.hosting?.site;
      if (typeof site === 'string' && site.trim()) {
        return `https://${site.trim()}.web.app`;
      }
    } catch (_) {
      // Ignore parse issues and fallback to legacy domain.
    }
  }

  return LEGACY_FALLBACK_URL;
}

export function inferHostFromUrl(url) {
  return new URL(normalizeUrl(url)).hostname;
}

