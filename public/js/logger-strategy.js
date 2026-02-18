/**
 * Professional Logger with Levels and Categories
 * Implements enterprise-grade logging with multiple destinations
 *
 * @version 2.0.0
 * @author WifiHackX Team
 */

import {
  LOG_LEVELS,
  LOG_CATEGORIES,
  CURRENT_LOG_LEVEL,
  LOG_DESTINATIONS,
  CONSOLE_STYLES,
  RATE_LIMITS,
  SESSION_CONFIG,
  ENVIRONMENT,
} from './logger-config.js';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.log(...args);
  }
};

class Logger {
  constructor() {
    this.sessionLogs = [];
    this.groups = new Map();
    this.rateLimiter = {
      logsThisSecond: 0,
      logsThisMinute: 0,
      lastSecondReset: Date.now(),
      lastMinuteReset: Date.now(),
    };

    this._initializeStorage();
    this._setupRateLimitReset();
  }

  /**
   * Initialize storage for persistent logs
   * @private
   */
  _initializeStorage() {
    try {
      const existing = localStorage.getItem(SESSION_CONFIG.persistentKey);
      if (!existing) {
        localStorage.setItem(SESSION_CONFIG.persistentKey, JSON.stringify([]));
      }
    } catch (_e) {
      console.warn('Logger: localStorage not available');
    }
  }

  /**
   * Setup rate limit reset timers
   * @private
   */
  _setupRateLimitReset() {
    // Reset per-second counter
    setInterval(() => {
      this.rateLimiter.logsThisSecond = 0;
      this.rateLimiter.lastSecondReset = Date.now();
    }, 1000);

    // Reset per-minute counter
    setInterval(() => {
      this.rateLimiter.logsThisMinute = 0;
      this.rateLimiter.lastMinuteReset = Date.now();
    }, 60000);
  }

  /**
   * Check if rate limit is exceeded
   * @private
   */
  _isRateLimited() {
    if (this.rateLimiter.logsThisSecond >= RATE_LIMITS.maxLogsPerSecond) {
      return true;
    }
    if (this.rateLimiter.logsThisMinute >= RATE_LIMITS.maxLogsPerMinute) {
      return true;
    }
    return false;
  }

  /**
   * Increment rate limiter counters
   * @private
   */
  _incrementRateLimiter() {
    this.rateLimiter.logsThisSecond++;
    this.rateLimiter.logsThisMinute++;
  }

  // ============================================
  // Public API - Log Methods
  // ============================================

  /**
   * Log with CRITICAL level (fatal errors)
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  critical(message, category = LOG_CATEGORIES.ERROR, data = null) {
    this._log(LOG_LEVELS.CRITICAL, message, category, data);
  }

  /**
   * Log with ERROR level
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  error(message, category = LOG_CATEGORIES.ERROR, data = null) {
    this._log(LOG_LEVELS.ERROR, message, category, data);
  }

  /**
   * Log with WARN level
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  warn(message, category = LOG_CATEGORIES.CORE, data = null) {
    this._log(LOG_LEVELS.WARN, message, category, data);
  }

  /**
   * Log with INFO level
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  info(message, category = LOG_CATEGORIES.CORE, data = null) {
    this._log(LOG_LEVELS.INFO, message, category, data);
  }

  /**
   * Log with DEBUG level
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  debug(message, category = LOG_CATEGORIES.CORE, data = null) {
    this._log(LOG_LEVELS.DEBUG, message, category, data);
  }

  /**
   * Log with TRACE level (verbose)
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  trace(message, category = LOG_CATEGORIES.CORE, data = null) {
    this._log(LOG_LEVELS.TRACE, message, category, data);
  }

  /**
   * Generic log method (Compatibility with LoggerService and legacy code)
   * @param {string} message - Log message
   * @param {string} category - Log category
   * @param {*} data - Additional data
   */
  log(message, category = LOG_CATEGORIES.CORE, data = null) {
    this.info(message, category, data);
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {string} category - Log category
   */
  perf(operation, categoryOrDuration, durationMs = null) {
    let duration = 0;
    let category = 'PERF';

    if (typeof categoryOrDuration === 'number') {
      duration = categoryOrDuration;
      category = durationMs || 'PERF';
    } else {
      category = categoryOrDuration || 'PERF';
      duration = parseFloat(durationMs) || 0;
    }

    if (isNaN(duration)) {
      if (this.warn) {
        this.warn(`Invalid duration for ${operation}: ${duration}`, category);
      } else {
        console.warn(
          `[WARN][${category}] Invalid duration for ${operation}: ${duration}`
        );
      }
      return;
    }

    const level =
      typeof LOG_LEVELS !== 'undefined'
        ? duration > 3000
          ? LOG_LEVELS.CRITICAL
          : duration > 1000
            ? LOG_LEVELS.WARN
            : duration > 500
              ? LOG_LEVELS.INFO
              : LOG_LEVELS.DEBUG
        : 2; // Default to INFO level if LOG_LEVELS missing

    this._log(level, `${operation} took ${duration.toFixed(2)}ms`, category, {
      duration,
    });
  }

  // ============================================
  // Group Management
  // ============================================

  /**
   * Start a collapsible log group
   * @param {string} name - Group name
   * @param {string} emoji - Optional emoji
   * @param {boolean} collapsed - Start collapsed (default: false)
   */
  startGroup(name, emoji = '📦', collapsed = false) {
    if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;

    const groupName = `${emoji} ${name}`;

    if (collapsed) {
      console.groupCollapsed(groupName);
    } else {
      console.group(groupName);
    }

    this.groups.set(name, {
      started: Date.now(),
      emoji,
    });
  }

  /**
   * End a log group
   * @param {string} name - Group name
   */
  endGroup(name) {
    if (!this.groups.has(name)) return;

    const group = this.groups.get(name);
    const duration = Date.now() - group.started;

    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`${group.emoji} Completed in ${duration}ms`);
    }

    console.groupEnd();
    this.groups.delete(name);
  }

  // ============================================
  // Core Logging Logic
  // ============================================

  /**
   * Internal log method
   * @private
   */
  _log(level, message, category, data) {
    // Filter by level
    if (level > CURRENT_LOG_LEVEL) return;

    // Rate limiting (skip for CRITICAL)
    if (level > LOG_LEVELS.CRITICAL && this._isRateLimited()) {
      return;
    }

    this._incrementRateLimiter();

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      levelName: this._getLevelName(level),
      category,
      message,
      data,
      environment: ENVIRONMENT,
    };

    // Save to session
    this._saveToSession(logEntry);

    // Destinations
    if (LOG_DESTINATIONS.console) {
      this._logToConsole(level, category, message, data);
    }

    if (LOG_DESTINATIONS.localStorage && level <= LOG_LEVELS.WARN) {
      this._saveToLocalStorage(logEntry);
    }

    if (LOG_DESTINATIONS.sentry && level <= LOG_LEVELS.ERROR) {
      this._sendToSentry(logEntry);
    }

    if (LOG_DESTINATIONS.analytics && level <= LOG_LEVELS.INFO) {
      this._sendToAnalytics(logEntry);
    }
  }

  /**
   * Get level name from level number
   * @private
   */
  _getLevelName(level) {
    return (
      Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level) || 'UNKNOWN'
    );
  }

  /**
   * Get emoji for level
   * @private
   */
  _getEmojiForLevel(level) {
    const emojis = {
      [LOG_LEVELS.CRITICAL]: '🔴',
      [LOG_LEVELS.ERROR]: '❌',
      [LOG_LEVELS.WARN]: '⚠️',
      [LOG_LEVELS.INFO]: 'ℹ️',
      [LOG_LEVELS.DEBUG]: '🔧',
      [LOG_LEVELS.TRACE]: '🔍',
    };
    return emojis[level] || '📝';
  }

  // ============================================
  // Destination Handlers
  // ============================================

  /**
   * Log to console with formatting
   * @private
   */
  _logToConsole(level, category, message, data) {
    const emoji = this._getEmojiForLevel(level);
    const levelName = this._getLevelName(level);
    const prefix = `${emoji} [${category}]`;
    const style = CONSOLE_STYLES[levelName] || '';

    if (ENVIRONMENT === 'development' && style) {
      // Styled console in development
      if (data) {
        console.log(`%c${levelName}%c ${prefix} ${message}`, style, '', data);
      } else {
        console.log(`%c${levelName}%c ${prefix} ${message}`, style, '');
      }
    } else {
      // Simple console in production
      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Save to session (in-memory)
   * @private
   */
  _saveToSession(entry) {
    this.sessionLogs.push(entry);

    // Keep only last N logs
    if (this.sessionLogs.length > SESSION_CONFIG.maxSessionLogs) {
      this.sessionLogs.shift();
    }
  }

  /**
   * Save to localStorage (persistent)
   * @private
   */
  _saveToLocalStorage(entry) {
    try {
      const logs = JSON.parse(
        localStorage.getItem(SESSION_CONFIG.persistentKey) || '[]'
      );
      logs.push(entry);

      // Keep only last N logs
      if (logs.length > SESSION_CONFIG.maxPersistentLogs) {
        logs.shift();
      }

      localStorage.setItem(SESSION_CONFIG.persistentKey, JSON.stringify(logs));
    } catch (_e) {
      // Silently fail if localStorage is full or unavailable
    }
  }

  /**
   * Send to Sentry
   * @private
   */
  _sendToSentry(entry) {
    if (!window.Sentry) return;

    try {
      const sentryLevel =
        entry.level === LOG_LEVELS.CRITICAL ? 'fatal' : 'error';

      window.Sentry.captureMessage(entry.message, {
        level: sentryLevel,
        tags: {
          category: entry.category,
          environment: ENVIRONMENT,
        },
        extra: entry.data || {},
      });
    } catch (e) {
      console.error('Failed to send to Sentry:', e);
    }
  }

  /**
   * Send to Analytics
   * @private
   */
  _sendToAnalytics(entry) {
    if (!window.gtag) return;

    try {
      window.gtag('event', 'app_log', {
        event_category: entry.category,
        event_label: entry.message,
        value: entry.level,
        custom_data: {
          level: entry.levelName,
          environment: ENVIRONMENT,
        },
      });
    } catch (e) {
      console.error('Failed to send to Analytics:', e);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get session logs
   * @returns {Array} Session logs
   */
  getSessionLogs() {
    return [...this.sessionLogs];
  }

  /**
   * Get persistent logs from localStorage
   * @returns {Array} Persistent logs
   */
  getPersistentLogs() {
    try {
      return JSON.parse(
        localStorage.getItem(SESSION_CONFIG.persistentKey) || '[]'
      );
    } catch {
      return [];
    }
  }

  /**
   * Clear session logs
   */
  clearSessionLogs() {
    this.sessionLogs = [];
  }

  /**
   * Clear persistent logs
   */
  clearPersistentLogs() {
    try {
      localStorage.setItem(SESSION_CONFIG.persistentKey, JSON.stringify([]));
    } catch (e) {
      console.error('Failed to clear persistent logs:', e);
    }
  }

  /**
   * Export logs as JSON
   * @returns {string} JSON string of all logs
   */
  exportLogs() {
    return JSON.stringify(
      {
        session: this.sessionLogs,
        persistent: this.getPersistentLogs(),
        timestamp: new Date().toISOString(),
        environment: ENVIRONMENT,
      },
      null,
      2
    );
  }

  /**
   * Get logger statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      sessionLogsCount: this.sessionLogs.length,
      persistentLogsCount: this.getPersistentLogs().length,
      activeGroups: this.groups.size,
      rateLimiter: {
        logsThisSecond: this.rateLimiter.logsThisSecond,
        logsThisMinute: this.rateLimiter.logsThisMinute,
      },
      environment: ENVIRONMENT,
      currentLevel: this._getLevelName(CURRENT_LOG_LEVEL),
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

const logger = new Logger();

// Expose globally for backward compatibility
window.Logger = logger;

// Also expose LOG_CATEGORIES for easy access
window.LOG_CATEGORIES = LOG_CATEGORIES;

debugLog('✅ [Logger] Professional logging system initialized');

export default logger;
export { LOG_LEVELS, LOG_CATEGORIES };
