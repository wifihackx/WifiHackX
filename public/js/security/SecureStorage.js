// Minimal secure storage wrapper for legacy modules.
const PREFIX = 'wfx_secure_';

function keyOf(key) {
  return `${PREFIX}${String(key || '').trim()}`;
}

function readRaw(key) {
  try {
    return localStorage.getItem(keyOf(key));
  } catch (_e) {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(keyOf(key), value);
    return true;
  } catch (_e) {
    return false;
  }
}

export function initSecureStorage() {
  if (window.SecureStorage) return window.SecureStorage;

  const api = {
    getSecureItem(key) {
      const raw = readRaw(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_e) {
        return raw;
      }
    },
    setSecureItem(key, value) {
      const payload =
        typeof value === 'string' ? value : JSON.stringify(value ?? null);
      return writeRaw(key, payload);
    },
    removeSecureItem(key) {
      try {
        localStorage.removeItem(keyOf(key));
        return true;
      } catch (_e) {
        return false;
      }
    },
  };

  window.SecureStorage = api;
  return api;
}
