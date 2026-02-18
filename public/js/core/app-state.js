// Lightweight AppState store used by legacy modules.
(() => {
  'use strict';

  const STORAGE_KEY = 'wifiHackX_state_v1';
  const HISTORY_LIMIT = 100;
  const subscribers = new Map();
  const history = [];
  let debugMode = false;
  let metrics = {
    setCalls: 0,
    getCalls: 0,
    subscriberCalls: 0,
  };

  const initialState = {
    user: {
      isAuthenticated: false,
      isAdmin: false,
      email: '',
      uid: '',
    },
    view: {
      current: 'homeView',
      previous: null,
      history: [],
    },
    modal: {
      active: null,
      data: null,
      history: [],
    },
    i18n: {
      currentLanguage: 'es',
      availableLanguages: ['es', 'en'],
    },
    notifications: {
      queue: [],
      unreadCount: 0,
    },
    admin: {
      stats: null,
    },
    settings: {},
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(initialState);
      const parsed = JSON.parse(raw);
      return { ...deepClone(initialState), ...(parsed || {}) };
    } catch (_e) {
      return deepClone(initialState);
    }
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_e) {}
  }

  function toPathParts(path) {
    return String(path || '')
      .split('.')
      .map(p => p.trim())
      .filter(Boolean);
  }

  function getAtPath(obj, path) {
    const parts = toPathParts(path);
    if (!parts.length) return obj;
    let current = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }

  function setAtPath(obj, path, value) {
    const parts = toPathParts(path);
    if (!parts.length) return value;
    const root = obj;
    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return root;
  }

  function notify(path, nextValue, prevValue) {
    const cbs = subscribers.get(path);
    if (!cbs || cbs.size === 0) return;
    cbs.forEach(cb => {
      try {
        metrics.subscriberCalls += 1;
        cb(nextValue, prevValue);
      } catch (_e) {}
    });
  }

  function pushHistory(entry) {
    history.push({ ...entry, at: new Date().toISOString() });
    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }
  }

  let state = loadPersistedState();

  const AppState = {
    getState(path) {
      metrics.getCalls += 1;
      return path ? getAtPath(state, path) : state;
    },

    setState(path, value, silent = false) {
      if (!path) return;
      metrics.setCalls += 1;
      const prevValue = getAtPath(state, path);
      setAtPath(state, path, value);
      persistState();
      pushHistory({ type: 'setState', path, prevValue, nextValue: value });
      if (!silent) {
        notify(path, value, prevValue);
      }
      if (debugMode) {
        console.debug('[AppState] setState', path, value);
      }
    },

    subscribe(path, callback) {
      if (!path || typeof callback !== 'function') {
        return () => {};
      }
      const current = subscribers.get(path) || new Set();
      current.add(callback);
      subscribers.set(path, current);
      return () => {
        const set = subscribers.get(path);
        if (!set) return;
        set.delete(callback);
        if (set.size === 0) {
          subscribers.delete(path);
        }
      };
    },

    batchUpdate(updates = {}) {
      Object.entries(updates).forEach(([path, value]) => {
        AppState.setState(path, value, true);
      });
      Object.entries(updates).forEach(([path, value]) => {
        notify(path, value, undefined);
      });
    },

    clearPersistedState() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_e) {}
    },

    getStateHistory() {
      return history.slice();
    },

    setDebugMode(enabled) {
      debugMode = Boolean(enabled);
    },

    getMetrics() {
      return { ...metrics, subscribers: subscribers.size };
    },

    resetState() {
      state = deepClone(initialState);
      AppState.clearPersistedState();
      persistState();
      pushHistory({ type: 'resetState' });
    },
  };

  Object.defineProperty(AppState, '_state', {
    get() {
      return state;
    },
  });

  window.AppState = AppState;
})();
