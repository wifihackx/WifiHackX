/**
 * @fileoverview Centralized State Management System (AppState)
 * @module core/app-state
 * @description
 * Provides a single source of truth for all application state using the Observer pattern.
 * Implements reactive state updates with automatic subscriber notifications.
 *
 * @author WifiHackX Development Team
 * @version 1.0.0
 * @since 2026-01-22
 *
 * @example
 * import { getState, setState, subscribe } from './core/app-state.js';
 *
 * // Read state
 * const user = getState('user');
 *
 * // Update state
 * setState('user.email', 'user@example.com');
 *
 * // Subscribe to changes
 * const unsubscribe = subscribe('user', (newValue, oldValue) => {
 *   console.log('User changed:', newValue);
 * });
 */

/**
 * Centralized application state object
 * Single source of truth for all application state
 * @type {Object}
 */
const AppState = {
  // Authentication state
  user: {
    uid: null,
    email: null,
    displayName: null,
    photoURL: null,
    isAuthenticated: false,
    isAdmin: false,
    role: 'client',
  },

  // View/Navigation state
  view: {
    current: 'homeView',
    previous: null,
    history: [],
  },

  // Shopping cart state
  cart: {
    items: [],
    count: 0,
    total: 0,
  },

  // Modal state
  modal: {
    active: null,
    history: [],
    data: null,
  },

  // Notifications state
  notifications: {
    queue: [],
    unreadCount: 0,
  },

  // Internationalization state
  i18n: {
    currentLanguage: 'es',
    availableLanguages: ['es', 'en', 'fr', 'de'],
    translations: {},
  },

  // Admin panel state
  admin: {
    data: null,
    filters: {},
    selectedUsers: [],
    stats: {},
  },

  // UI state
  ui: {
    isLoading: false,
    theme: 'dark',
    sidebarOpen: false,
  },
};

/**
 * Observer registry for state subscriptions
 * @private
 */
const observers = {
  // Exact path subscriptions: Map<string, Array<Function>>
  exact: new Map(),

  // Wildcard subscriptions: Map<string, Array<Function>>
  wildcard: new Map(),

  // Root subscriptions (listen to all changes): Array<Function>
  root: [],
};

/**
 * State change history for debugging
 * @private
 */
const stateHistory = [];

/**
 * Debug mode flag
 * @private
 */
let debugMode = false;

/**
 * Performance metrics
 * @private
 */
const metrics = {
  totalStateUpdates: 0,
  totalNotifications: 0,
  notificationTimes: [],
};

/**
 * Batch update flag
 * @private
 */
let isBatchUpdate = false;

/**
 * Pending batch notifications
 * @private
 */
const batchNotifications = new Map();

/**
 * Subscription ID counter
 * @private
 */
let subscriptionIdCounter = 0;

/**
 * Persistence configuration
 * Defines which state paths should be persisted to localStorage
 * @private
 */
const persistenceConfig = {
  // Paths to persist
  paths: ['user', 'cart', 'i18n.currentLanguage', 'ui.theme'],

  // Storage key prefix
  prefix: 'wifiHackX_state_',

  // Debounce delay (ms)
  debounceDelay: 300,
};

/**
 * Debounce timers for persistence operations
 * @private
 */
const persistenceTimers = new Map();

/**
 * Initialize the AppState module
 * @private
 */
function initializeAppState() {
  // 1. Cleanup corrupted data FIRST
  cleanupCorruptedData();

  // 2. Load persisted state from localStorage
  loadPersistedState();

  // 3. Set up automatic persistence for configured paths
  for (const path of persistenceConfig.paths) {
    subscribe(path, () => {
      persistPath(path);
    });
  }

  // Note: Window exposure is now handled at the end of the file
  // This allows the script to work both as a module and as a regular script

  if (debugMode) {
    console.log('[AppState] Initialized with state:', AppState);
    console.log(
      '[AppState] Persistence enabled for paths:',
      persistenceConfig.paths
    );
  }
}

/**
 * Cleanup corrupted data in localStorage
 * Removes keys that are not valid JSON
 * @private
 */
function cleanupCorruptedData() {
  if (!isLocalStorageAvailable()) return;

  const keys = Object.keys(localStorage);
  let removedCount = 0;

  keys.forEach(key => {
    if (key.startsWith(persistenceConfig.prefix)) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          JSON.parse(data);
        }
      } catch (e) {
        console.warn(`[AppState] Removing corrupted key: ${key}`, e);
        localStorage.removeItem(key);
        removedCount++;
      }
    }
  });

  if (removedCount > 0 && debugMode) {
    console.log(`[AppState] Cleaned up ${removedCount} corrupted keys`);
  }
}

/**
 * Parse a dot-notation path into an array of keys
 * @private
 * @param {string} path - Dot-notation path (e.g., "user.email")
 * @returns {string[]} Array of path segments
 * @example
 * parsePath('user.email') // ['user', 'email']
 */
function parsePath(path) {
  if (!path || typeof path !== 'string') {
    return [];
  }
  return path.split('.').filter(segment => segment.length > 0);
}

/**
 * Get value at a specific path in an object
 * @private
 * @param {Object} obj - Object to traverse
 * @param {string[]} pathSegments - Array of path segments
 * @returns {any} Value at path or undefined if not found
 */
function getValueAtPath(obj, pathSegments) {
  let current = obj;

  for (const segment of pathSegments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

/**
 * Deep clone a value to prevent external mutations
 * @private
 * @param {any} value - Value to clone
 * @param {WeakMap} [seen] - Map to track circular references
 * @returns {any} Deep cloned value
 */
function deepClone(value, seen = new WeakMap()) {
  // Handle primitives and null
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Check for circular references
  if (seen.has(value)) {
    // Return a placeholder for circular references
    return {
      __circular__: true,
    };
  }

  // Handle Date objects
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    seen.set(value, true);
    const clonedArray = value.map(item => deepClone(item, seen));
    seen.delete(value);
    return clonedArray;
  }

  // Handle plain objects
  // Use structuredClone if available (modern browsers)
  if (typeof globalThis.structuredClone !== 'undefined') {
    try {
      return globalThis.structuredClone(value);
    } catch (_error) {
      // Fall back to manual cloning if structuredClone fails
      if (debugMode) {
        console.warn(
          '[AppState] structuredClone failed, using fallback:',
          _error
        );
      }
    }
  }

  // Fallback: Manual deep clone for objects
  seen.set(value, true);
  const cloned = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      cloned[key] = deepClone(value[key], seen);
    }
  }
  seen.delete(value);

  return cloned;
}

/**
 * Check if a path matches a wildcard pattern
 * @private
 * @param {string} path - Actual path (e.g., "user.email")
 * @param {string} pattern - Wildcard pattern (e.g., "user.*")
 * @returns {boolean} True if path matches pattern
 * @example
 * matchesWildcard('user.email', 'user.*') // true
 * matchesWildcard('user.email', 'cart.*') // false
 * matchesWildcard('user.profile.name', 'user.*') // true
 */
function matchesWildcard(path, pattern) {
  // Convert wildcard pattern to regex
  // Escape special regex characters except *
  const regexPattern = pattern
    .split('.')
    .map(segment => {
      if (segment === '*') {
        // * matches any segment(s)
        return '.*';
      }
      // Escape special regex characters
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('\\.');

  // Create regex with anchors
  const regex = new RegExp(`^${regexPattern}$`);

  return regex.test(path);
}

/**
 * Get state value at a specific path
 * Returns immutable copies to prevent external mutations
 * @param {string} [path] - Dot-notation path (e.g., "user.email")
 * @returns {any} State value or entire state if no path provided
 * @example
 * // Get entire state
 * const state = getState();
 *
 * // Get specific value
 * const email = getState('user.email');
 *
 * // Get nested object
 * const user = getState('user');
 */
function getState(path) {
  // Return entire state if no path provided
  if (!path) {
    if (debugMode) {
      console.log('[AppState] getState() - returning entire state');
    }
    return deepClone(AppState);
  }

  // Parse path and get value
  const pathSegments = parsePath(path);

  if (pathSegments.length === 0) {
    if (debugMode) {
      console.warn('[AppState] getState() - invalid path:', path);
    }
    return undefined;
  }

  const value = getValueAtPath(AppState, pathSegments);

  if (debugMode) {
    console.log(`[AppState] getState('${path}') =`, value);
  }

  // Return deep clone to prevent mutations
  return deepClone(value);
}

/**
 * Deep merge two objects
 * @private
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  // Handle non-object cases
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (target === null || typeof target !== 'object') {
    return source;
  }

  // Handle arrays - replace instead of merge
  if (Array.isArray(source)) {
    return source;
  }

  // Merge objects
  const result = {
    ...target,
  };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      // Recursively merge nested objects
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Set value at a specific path in an object
 * Supports partial updates for nested objects
 * @private
 * @param {Object} obj - Object to modify
 * @param {string[]} pathSegments - Array of path segments
 * @param {any} value - Value to set
 * @returns {boolean} True if successful, false otherwise
 */
function setValueAtPath(obj, pathSegments, value) {
  if (pathSegments.length === 0) {
    return false;
  }

  let current = obj;

  // Navigate to the parent of the target property
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];

    // If the path doesn't exist, create it
    if (!(segment in current)) {
      current[segment] = {};
    }

    // If the current value is not an object, we can't continue
    if (typeof current[segment] !== 'object' || current[segment] === null) {
      return false;
    }

    current = current[segment];
  }

  // Set the final property
  const finalSegment = pathSegments[pathSegments.length - 1];

  // If the value is an object and the current value is also an object,
  // perform a deep merge to preserve sibling properties
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    current[finalSegment] &&
    typeof current[finalSegment] === 'object' &&
    !Array.isArray(current[finalSegment])
  ) {
    current[finalSegment] = deepMerge(current[finalSegment], value);
  } else {
    // Otherwise, replace the value
    current[finalSegment] = value;
  }

  return true;
}

/**
 * Validate a state path
 * @private
 * @param {string} path - Path to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidPath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Empty string is invalid
  if (path.trim().length === 0) {
    return false;
  }

  // Path should not start or end with a dot
  if (path.startsWith('.') || path.endsWith('.')) {
    return false;
  }

  // Path should not contain consecutive dots
  if (path.includes('..')) {
    return false;
  }

  return true;
}

/**
 * Notify all observers that match a given path
 * @private
 * @param {string} path - Path that changed
 * @param {any} newValue - New value
 * @param {any} oldValue - Old value
 */
function notifyObservers(path, newValue, oldValue) {
  const callbacks = [];

  // 1. Collect exact match callbacks
  if (observers.exact.has(path)) {
    callbacks.push(...observers.exact.get(path));
  }

  // 2. Collect wildcard match callbacks
  for (const [pattern, subs] of observers.wildcard) {
    if (matchesWildcard(path, pattern)) {
      callbacks.push(...subs);
    }
  }

  // 3. Collect root callbacks
  callbacks.push(...observers.root);

  // 4. Invoke all callbacks (with error handling)
  const startTime =
    typeof globalThis.performance !== 'undefined'
      ? globalThis.performance.now()
      : Date.now();

  callbacks.forEach(subscription => {
    try {
      subscription.callback(newValue, oldValue, path);
    } catch (error) {
      console.error(`[AppState] Observer error for path "${path}":`, error);
    }
  });

  const endTime =
    typeof globalThis.performance !== 'undefined'
      ? globalThis.performance.now()
      : Date.now();
  const duration = endTime - startTime;

  // Update metrics
  metrics.totalNotifications += callbacks.length;
  metrics.notificationTimes.push(duration);

  // Keep only last 100 notification times
  if (metrics.notificationTimes.length > 100) {
    metrics.notificationTimes.shift();
  }

  // Debug logging
  if (debugMode) {
    console.log(
      `[AppState] Notified ${callbacks.length} observers for path "${path}" in ${duration.toFixed(2)}ms`
    );
  }
}

/**
 * Update state at a specific path
 * Notifies all registered observers unless silent is true
 * @param {string} path - Dot-notation path
 * @param {any} value - New value
 * @param {boolean} [silent=false] - If true, don't notify observers
 * @example
 * // Update user email
 * setState('user.email', 'user@example.com');
 *
 * // Update nested object
 * setState('user', { uid: '123', email: 'user@example.com' });
 *
 * // Silent update (no notifications)
 * setState('user.email', 'user@example.com', true);
 */
function setState(path, value, silent = false) {
  // Validate path
  if (!isValidPath(path)) {
    console.warn('[AppState] setState() - invalid path:', path);
    return;
  }

  // Parse path
  const pathSegments = parsePath(path);

  if (pathSegments.length === 0) {
    console.warn('[AppState] setState() - empty path after parsing:', path);
    return;
  }

  // Get old value for observer notifications
  const oldValue = getValueAtPath(AppState, pathSegments);

  // Set new value
  const success = setValueAtPath(AppState, pathSegments, value);

  if (!success) {
    console.warn('[AppState] setState() - failed to set value at path:', path);
    return;
  }

  // Update metrics
  metrics.totalStateUpdates++;

  // Record state change in history
  if (stateHistory.length >= 50) {
    stateHistory.shift(); // Remove oldest entry
  }
  stateHistory.push({
    timestamp: new Date(),
    path,
    oldValue: deepClone(oldValue),
    newValue: deepClone(value),
    source: 'setState',
  });

  // Debug logging
  if (debugMode) {
    console.log(`[AppState] setState('${path}')`, {
      oldValue,
      newValue: value,
    });
  }

  // Notify observers unless silent or in batch mode
  if (!silent) {
    if (isBatchUpdate) {
      // Collect notifications for batch processing
      batchNotifications.set(path, {
        newValue: value,
        oldValue,
      });
    } else {
      // Notify immediately
      notifyObservers(path, value, oldValue);
    }
  }
}

/**
 * Subscribe to state changes at a specific path
 * Supports exact paths and wildcard patterns (e.g., "user.*")
 * @param {string} path - Dot-notation path or wildcard pattern
 * @param {Function} callback - Function to call on state change (newValue, oldValue, path)
 * @returns {Function} Unsubscribe function
 * @example
 * // Subscribe to specific path
 * const unsubscribe = subscribe('user.email', (newValue, oldValue) => {
 *   console.log('Email changed:', newValue);
 * });
 *
 * // Subscribe to wildcard pattern
 * subscribe('user.*', (newValue, oldValue, path) => {
 *   console.log(`User property ${path} changed:`, newValue);
 * });
 *
 * // Unsubscribe
 * unsubscribe();
 */
function subscribe(path, callback) {
  // Validate inputs
  if (!path || typeof path !== 'string') {
    console.warn('[AppState] subscribe() - invalid path:', path);
    return () => {}; // Return no-op unsubscribe function
  }

  if (typeof callback !== 'function') {
    console.warn('[AppState] subscribe() - callback must be a function');
    return () => {}; // Return no-op unsubscribe function
  }

  // Generate unique subscription ID
  const subscriptionId = `sub_${++subscriptionIdCounter}_${Date.now()}`;

  // Determine subscription type and store
  if (path === '*') {
    // Root subscription - listen to all changes
    observers.root.push({
      id: subscriptionId,
      callback,
    });

    if (debugMode) {
      console.log(
        '[AppState] Subscribed to all state changes:',
        subscriptionId
      );
    }
  } else if (path.includes('*')) {
    // Wildcard subscription
    if (!observers.wildcard.has(path)) {
      observers.wildcard.set(path, []);
    }
    observers.wildcard.get(path).push({
      id: subscriptionId,
      callback,
    });

    if (debugMode) {
      console.log(
        `[AppState] Subscribed to wildcard pattern "${path}":`,
        subscriptionId
      );
    }
  } else {
    // Exact path subscription
    if (!observers.exact.has(path)) {
      observers.exact.set(path, []);
    }
    observers.exact.get(path).push({
      id: subscriptionId,
      callback,
    });

    if (debugMode) {
      console.log(`[AppState] Subscribed to path "${path}":`, subscriptionId);
    }
  }

  // Return unsubscribe function
  return function unsubscribe() {
    if (path === '*') {
      // Remove from root subscriptions
      const index = observers.root.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        observers.root.splice(index, 1);
        if (debugMode) {
          console.log(
            '[AppState] Unsubscribed from all state changes:',
            subscriptionId
          );
        }
      }
    } else if (path.includes('*')) {
      // Remove from wildcard subscriptions
      const subs = observers.wildcard.get(path);
      if (subs) {
        const index = subs.findIndex(sub => sub.id === subscriptionId);
        if (index !== -1) {
          subs.splice(index, 1);
          // Clean up empty arrays
          if (subs.length === 0) {
            observers.wildcard.delete(path);
          }
          if (debugMode) {
            console.log(
              `[AppState] Unsubscribed from wildcard pattern "${path}":`,
              subscriptionId
            );
          }
        }
      }
    } else {
      // Remove from exact subscriptions
      const subs = observers.exact.get(path);
      if (subs) {
        const index = subs.findIndex(sub => sub.id === subscriptionId);
        if (index !== -1) {
          subs.splice(index, 1);
          // Clean up empty arrays
          if (subs.length === 0) {
            observers.exact.delete(path);
          }
          if (debugMode) {
            console.log(
              `[AppState] Unsubscribed from path "${path}":`,
              subscriptionId
            );
          }
        }
      }
    }
  };
}

/**
 * Batch multiple state updates
 * Notifies observers only once after all updates complete
 * @param {Function} updateFn - Function that performs multiple setState calls
 * @example
 * batchUpdate(() => {
 *   setState('user.email', 'user@example.com');
 *   setState('user.displayName', 'John Doe');
 *   setState('user.isAuthenticated', true);
 * });
 * // Observers are notified only once after all three updates
 */
function batchUpdate(updateFn) {
  if (typeof updateFn !== 'function') {
    console.warn('[AppState] batchUpdate() - updateFn must be a function');
    return;
  }

  // Set batch mode flag
  isBatchUpdate = true;
  batchNotifications.clear();

  try {
    // Execute the update function
    updateFn();
  } catch (error) {
    console.error('[AppState] Error during batch update:', error);
  } finally {
    // Reset batch mode flag
    isBatchUpdate = false;

    // Notify all collected observers
    for (const [path, { newValue, oldValue }] of batchNotifications) {
      notifyObservers(path, newValue, oldValue);
    }

    // Clear batch notifications
    batchNotifications.clear();
  }
}

/**
 * Check if localStorage is available
 * @private
 * @returns {boolean} True if localStorage is available
 */
function isLocalStorageAvailable() {
  try {
    const testKey = '__appstate_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Validate persisted state data
 * @private
 * @param {any} data - Data to validate
 * @returns {boolean} True if data is valid
 */
function isValidPersistedData(data, path) {
  // Allow primitives for specific paths
  if (path === 'i18n.currentLanguage' || path === 'ui.theme') {
    return (
      typeof data === 'string' ||
      typeof data === 'number' ||
      typeof data === 'boolean'
    );
  }

  // Objects required for other paths
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (Array.isArray(data)) {
    return false;
  }

  return true;
}

/**
 * Load persisted state from localStorage
 * Validates data before loading into AppState
 * @private
 */
function loadPersistedState() {
  // Check if localStorage is available
  if (!isLocalStorageAvailable()) {
    if (debugMode) {
      console.warn(
        '[AppState] localStorage not available, skipping persistence load'
      );
    }
    return;
  }

  // Load each configured path
  for (const path of persistenceConfig.paths) {
    try {
      const storageKey = persistenceConfig.prefix + path;
      const storedValue = localStorage.getItem(storageKey);

      if (storedValue === null) {
        // No persisted data for this path
        continue;
      }

      // Ignore sentinel/invalid string values
      if (storedValue === 'null' || storedValue === 'undefined') {
        localStorage.removeItem(storageKey);
        continue;
      }

      // Parse JSON
      const parsedValue = JSON.parse(storedValue);

      // Validate data
      if (!isValidPersistedData(parsedValue, path)) {
        if (path !== 'user') {
          console.warn(
            `[AppState] Invalid persisted data for path "${path}", skipping`
          );
        }
        // Remove invalid persisted value to prevent repeated warnings
        localStorage.removeItem(storageKey);
        continue;
      }

      // Load into AppState (silent update to avoid triggering observers during initialization)
      setState(path, parsedValue, true);

      if (debugMode) {
        console.log(`[AppState] Loaded persisted state for path "${path}"`);
      }
    } catch (error) {
      console.error(
        `[AppState] Error loading persisted state for path "${path}":`,
        error
      );
      // Continue with other paths even if one fails
    }
  }
}

/**
 * Persist a specific state path to localStorage
 * Debounces persistence operations to avoid excessive writes
 * @private
 * @param {string} path - State path to persist
 */
function persistPath(path) {
  // Check if localStorage is available
  if (!isLocalStorageAvailable()) {
    return;
  }

  // Clear existing timer for this path
  if (persistenceTimers.has(path)) {
    clearTimeout(persistenceTimers.get(path));
  }

  // Set up debounced persistence
  const timer = setTimeout(() => {
    try {
      const storageKey = persistenceConfig.prefix + path;
      let value = getValueAtPath(AppState, parsePath(path));

      // Don't persist undefined values (Firestore best practice)
      if (value === undefined) {
        if (debugMode) {
          console.warn(
            `[AppState] Skipping persistence of undefined value for path "${path}"`
          );
        }
        return;
      }

      // OPTIMIZACIÓN: Solo persistir campos esenciales para el usuario
      // Evita exceder la quota de localStorage (~5MB)
      if (path === 'user' && value && typeof value === 'object') {
        value = {
          uid: value.uid,
          email: value.email,
          displayName: value.displayName,
          isAuthenticated: value.isAuthenticated,
          isAdmin: value.isAdmin,
          role: value.role,
        };
      }

      // Serialize to JSON
      const serialized = JSON.stringify(value);

      // OPTIMIZACIÓN: Límite de tamaño para persistencia (100KB)
      if (serialized.length > 100000) {
        console.warn(
          `[AppState] Data too large for path "${path}" (${serialized.length} bytes), skipping persistence`
        );
        return;
      }

      // Save to localStorage
      localStorage.setItem(storageKey, serialized);

      if (debugMode) {
        console.log(`[AppState] Persisted state for path "${path}"`);
      }

      // Update metrics
      if (metrics.persistenceOperations === undefined) {
        metrics.persistenceOperations = 0;
      }
      metrics.persistenceOperations++;
    } catch (_error) {
      // Handle quota exceeded or other localStorage errors
      if (_error.name === 'QuotaExceededError' || _error.code === 22) {
        console.error(
          `[AppState] localStorage quota exceeded, cannot persist path "${path}"`
        );
      } else {
        console.error(
          `[AppState] Error persisting state for path "${path}":`,
          _error
        );
      }
    } finally {
      // Clean up timer
      persistenceTimers.delete(path);
    }
  }, persistenceConfig.debounceDelay);

  // Store timer
  persistenceTimers.set(path, timer);
}

/**
 * Clear persisted state from localStorage
 * @param {string} [path] - Optional specific path to clear
 */
function clearPersistedState(path) {
  if (!isLocalStorageAvailable()) {
    return;
  }

  if (path) {
    // Clear specific path
    const storageKey = persistenceConfig.prefix + path;
    localStorage.removeItem(storageKey);

    if (debugMode) {
      console.log(`[AppState] Cleared persisted state for path "${path}"`);
    }
  } else {
    // Clear all persisted state
    for (const configPath of persistenceConfig.paths) {
      const storageKey = persistenceConfig.prefix + configPath;
      localStorage.removeItem(storageKey);
    }

    if (debugMode) {
      console.log('[AppState] Cleared all persisted state');
    }
  }
}

/**
 * Get state change history
 * Returns recent state changes for debugging
 * @param {number} [limit=50] - Number of recent changes to return
 * @returns {Array} Array of state change records
 * @example
 * const history = getStateHistory(10);
 * console.log('Recent changes:', history);
 */
function getStateHistory(limit = 50) {
  const historyLimit = Math.min(limit, stateHistory.length);
  return stateHistory.slice(-historyLimit).map(record => ({
    timestamp: record.timestamp,
    path: record.path,
    oldValue: deepClone(record.oldValue),
    newValue: deepClone(record.newValue),
    source: record.source,
  }));
}

/**
 * Enable or disable debug mode
 * When enabled, logs all state changes and observer notifications
 * @param {boolean} enabled - Whether to enable debug logging
 * @example
 * setDebugMode(true); // Enable debug logging
 * setDebugMode(false); // Disable debug logging
 */
function setDebugMode(enabled) {
  debugMode = enabled;
  console.log(`[AppState] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get performance metrics
 * Returns statistics about state updates and observer notifications
 * @returns {Object} Performance statistics
 * @example
 * const metrics = getMetrics();
 * console.log('Total updates:', metrics.totalStateUpdates);
 */
function getMetrics() {
  const notificationTimes = metrics.notificationTimes || [];
  const averageNotificationTime =
    notificationTimes.length > 0
      ? notificationTimes.reduce((sum, time) => sum + time, 0) /
        notificationTimes.length
      : 0;

  const slowestNotification =
    notificationTimes.length > 0 ? Math.max(...notificationTimes) : 0;

  const subscriberCount =
    observers.root.length +
    Array.from(observers.exact.values()).reduce(
      (sum, subs) => sum + subs.length,
      0
    ) +
    Array.from(observers.wildcard.values()).reduce(
      (sum, subs) => sum + subs.length,
      0
    );

  return {
    totalStateUpdates: metrics.totalStateUpdates || 0,
    totalNotifications: metrics.totalNotifications || 0,
    averageNotificationTime: averageNotificationTime.toFixed(2),
    slowestNotification: slowestNotification.toFixed(2),
    subscriberCount,
    persistenceOperations: metrics.persistenceOperations || 0,
    historySize: stateHistory.length,
  };
}

/**
 * Reset state to initial values
 * @param {string} [path] - Optional path to reset specific section
 * @example
 * resetState('user'); // Reset only user state
 * resetState(); // Reset entire state
 */
function resetState(path) {
  const initialState = {
    user: {
      uid: null,
      email: null,
      displayName: null,
      photoURL: null,
      isAuthenticated: false,
      isAdmin: false,
      role: 'client',
    },
    view: {
      current: 'homeView',
      previous: null,
      history: [],
    },
    cart: {
      items: [],
      count: 0,
      total: 0,
    },
    modal: {
      active: null,
      history: [],
      data: null,
    },
    notifications: {
      queue: [],
      unreadCount: 0,
    },
    i18n: {
      currentLanguage: 'es',
      availableLanguages: ['es', 'en', 'fr', 'de'],
      translations: {},
    },
    admin: {
      data: null,
      filters: {},
      selectedUsers: [],
      stats: {},
    },
    ui: {
      isLoading: false,
      theme: 'dark',
      sidebarOpen: false,
    },
  };

  if (path) {
    // Reset specific path - use direct assignment to avoid deep merge
    const pathSegments = parsePath(path);
    if (pathSegments.length > 0) {
      const initialValue = getValueAtPath(initialState, pathSegments);

      // Get old value for notifications
      const oldValue = getValueAtPath(AppState, pathSegments);

      // Direct assignment to avoid deep merge preserving old properties
      let current = AppState;
      for (let i = 0; i < pathSegments.length - 1; i++) {
        current = current[pathSegments[i]];
      }
      current[pathSegments[pathSegments.length - 1]] = deepClone(initialValue);

      // Notify observers
      notifyObservers(path, initialValue, oldValue);

      if (debugMode) {
        console.log(`[AppState] Reset state for path "${path}"`);
      }
    }
  } else {
    // Reset entire state - use direct assignment to avoid deep merge
    for (const key in initialState) {
      const oldValue = AppState[key];
      AppState[key] = deepClone(initialState[key]);

      // Notify observers for each top-level key
      notifyObservers(key, initialState[key], oldValue);
    }

    if (debugMode) {
      console.log('[AppState] Reset entire state to initial values');
    }
  }
}

// Expose public API to window (for non-module usage)
if (typeof window !== 'undefined') {
  window.AppState = {
    getState,
    setState,
    subscribe,
    batchUpdate,
    clearPersistedState,
    getStateHistory,
    setDebugMode,
    getMetrics,
    resetState,
    // Direct access to state object (for inspection only in development)
    _state: AppState,
  };

  // Log in development mode
  const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('dev') ||
    window.location.hostname.includes('test');
  const verboseDevLogs = window.localStorage?.getItem('WFX_VERBOSE_DEV_LOGS') === '1';

  if (isDevelopment && verboseDevLogs) {
    console.log(
      '[AppState] Development mode - AppState exposed to window.AppState'
    );
    console.log('[AppState] Available methods:', Object.keys(window.AppState));
  }
}

// Initialize on module load
initializeAppState();
