/**
 * Logger Configuration
 * Central configuration for logging system
 *
 * @version 2.0.0
 * @author WifiHackX Team
 */

/**
 * Log Levels (Lower number = Higher priority)
 */
export const LOG_LEVELS = {
  CRITICAL: 0, // Fatal errors that break the application
  ERROR: 1, // Errors that affect functionality
  WARN: 2, // Important warnings
  INFO: 3, // Relevant system information
  DEBUG: 4, // Development debugging
  TRACE: 5, // Verbose development logs
};

/**
 * Log Categories (Hierarchical organization)
 */
export const LOG_CATEGORIES = {
  // Core system
  CORE: 'CORE',
  INIT: 'INIT',

  // Features
  AUTH: 'AUTH',
  FIREBASE: 'FIREBASE',
  NOTIFICATIONS: 'NOTIF',
  SECURITY: 'SEC',
  ADMIN: 'ADMIN',
  CART: 'CART',
  ANNOUNCEMENTS: 'ANN',
  USERS: 'USERS',

  // Performance
  PERF: 'PERF',
  CACHE: 'CACHE',

  // Infrastructure
  NETWORK: 'NET',
  STORAGE: 'STORE',

  // Errors
  ERROR: 'ERR',
};

/**
 * Environment Detection
 */
const detectEnvironment = () => {
  const hostname = window.location.hostname;

  // Development environments
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local')
  ) {
    return 'development';
  }

  // Staging environment
  if (hostname.includes('staging') || hostname.includes('dev.')) {
    return 'staging';
  }

  // Production
  return 'production';
};

export const ENVIRONMENT = detectEnvironment();

/**
 * Current Log Level based on environment
 * Development: DEBUG (see most logs)
 * Staging: INFO (see important logs)
 * Production: WARN (only warnings and errors)
 */
export const CURRENT_LOG_LEVEL = (() => {
  switch (ENVIRONMENT) {
    case 'development':
      return LOG_LEVELS.DEBUG;
    case 'staging':
      return LOG_LEVELS.INFO;
    case 'production':
      return LOG_LEVELS.WARN;
    default:
      return LOG_LEVELS.WARN;
  }
})();

/**
 * Log Destinations Configuration
 */
export const LOG_DESTINATIONS = {
  console: true, // Always log to console (filtered by level)
  localStorage: true, // Store critical logs locally
  analytics: ENVIRONMENT === 'production', // Send to analytics in production
  sentry: ENVIRONMENT === 'production', // Send errors to Sentry in production
  firestore: false, // Admin audit logs (disabled by default)
};

/**
 * Console Styling
 */
export const CONSOLE_STYLES = {
  CRITICAL:
    'background: #ff0000; color: #ffffff; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
  ERROR:
    'background: #ff4444; color: #ffffff; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
  WARN: 'background: #ff9800; color: #000000; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
  INFO: 'background: #2196f3; color: #ffffff; padding: 2px 4px; border-radius: 2px;',
  DEBUG: 'background: #4caf50; color: #ffffff; padding: 2px 4px; border-radius: 2px;',
  TRACE: 'background: #9e9e9e; color: #ffffff; padding: 2px 4px; border-radius: 2px;',
};

/**
 * Performance Monitoring Thresholds (ms)
 */
export const PERF_THRESHOLDS = {
  CRITICAL: 3000, // > 3s is critical
  WARN: 1000, // > 1s is warning
  INFO: 500, // > 500ms is info
};

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMITS = {
  maxLogsPerSecond: ENVIRONMENT === 'production' ? 10 : 100,
  maxLogsPerMinute: ENVIRONMENT === 'production' ? 100 : 1000,
};

/**
 * Session Storage Configuration
 */
export const SESSION_CONFIG = {
  maxSessionLogs: 50, // Keep last 50 logs in memory
  maxPersistentLogs: 20, // Keep last 20 critical logs in localStorage
  persistentKey: 'app_logs', // LocalStorage key
  sessionKey: 'session_logs', // SessionStorage key
};

if (window.Logger && typeof window.Logger.info === 'function') {
  window.Logger.info(
    `Environment: ${ENVIRONMENT}, Level: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === CURRENT_LOG_LEVEL)}`,
    LOG_CATEGORIES.INIT
  );
}
