// Lightweight secure storage adapter used by legacy modules.
// It provides a stable API and safe fallbacks when localStorage is unavailable.

const STORAGE_PREFIX = 'wfx:secure:';

const safeJsonParse = raw => {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

const safeJsonStringify = value => {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return null;
  }
};

const buildKey = key => `${STORAGE_PREFIX}${String(key || '')}`;

const SecureStorage = {
  getSecureItem(key, fallbackValue = null) {
    try {
      const raw = localStorage.getItem(buildKey(key));
      if (raw == null) return fallbackValue;
      const parsed = safeJsonParse(raw);
      return parsed == null ? fallbackValue : parsed;
    } catch (_error) {
      return fallbackValue;
    }
  },

  setSecureItem(key, value) {
    try {
      const payload = safeJsonStringify(value);
      if (payload == null) return false;
      localStorage.setItem(buildKey(key), payload);
      return true;
    } catch (_error) {
      return false;
    }
  },

  removeSecureItem(key) {
    try {
      localStorage.removeItem(buildKey(key));
      return true;
    } catch (_error) {
      return false;
    }
  },

  clearSecureNamespace() {
    try {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (_error) {
      return false;
    }
  },
};

export function initSecureStorage() {
  if (!window.SecureStorage) {
    window.SecureStorage = SecureStorage;
  }
}
