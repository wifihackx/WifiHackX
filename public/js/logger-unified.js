/**
 * LOGGER UNIFIED v1.0
 * ============================================
 * Reemplaza inconsistencias de logging
 * Unifica formato y elimina duplicados
 *
 * Uso: Logger.info('Tu mensaje', 'CATEGORÍA')
 */

class UnifiedLogger {
  constructor() {
    const isDev = this.detectEnvironment() === 'development';
    const quietLogs = this.getQuietFlag();
    this.config = {
      environment: this.detectEnvironment(),
      isDevelopment: isDev,
      level: quietLogs ? 2 : isDev ? 4 : 2, // WARN (2) si quiet
    };

    this.LOG_LEVELS = {
      CRITICAL: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4,
      TRACE: 5,
      PERF: 6, // Added level
    };

    this.LOG_ICONS = {
      CRITICAL: '🔴',
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔧',
      TRACE: '🔍',
      PERF: '⏱️',
    };

    this.LOG_COLORS = {
      CRITICAL: '#FF0000',
      ERROR: '#FF4444',
      WARN: '#FFA500',
      INFO: '#4A90E2',
      DEBUG: '#7ED321',
      TRACE: '#B8E986',
      PERF: '#00FFFF',
    };

    // Prevenir duplicados
    this.logCache = new Map();
    this.deduplicationWindow = 100; // ms

    // Optional external aggregation (Sentry) guardrails.
    // Keep this bounded to avoid flooding when Sentry is enabled.
    this.breadcrumbWindowMs = 60_000;
    this.breadcrumbMaxPerWindow = 20;
    this.breadcrumbWindowStart = 0;
    this.breadcrumbCount = 0;

    // Bind methods to this instance
    this.log = this.log.bind(this);
    this.info = this.info.bind(this);
    this.debug = this.debug.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.critical = this.critical.bind(this);
    this.trace = this.trace.bind(this);
    this.perf = this.perf.bind(this);
    this.section = this.section.bind(this);
    this.startGroup = this.startGroup.bind(this);
    this.endGroup = this.endGroup.bind(this);
  }

  detectEnvironment() {
    try {
      if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1')
      ) {
        return 'development';
      }
      return 'production';
    } catch {
      return 'production';
    }
  }

  getQuietFlag() {
    try {
      if (typeof window === 'undefined') return false;
      if (window.LOCAL_QUIET_LOGS === true) return true;
      if (window.location && window.location.hostname) {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  isDev() {
    return this.detectEnvironment() === 'development';
  }

  /**
   * MÉTODO PRINCIPAL - Usa este para loguear
   */
  log(level, category, message, data = null) {
    // Validar nivel
    if (!this.LOG_LEVELS.hasOwnProperty(level)) {
      console.error(`❌ [Logger] Invalid level: ${level}`);
      return;
    }

    // Verificar si debería loguear
    if (this.LOG_LEVELS[level] > this.config.level && level !== 'PERF') {
      return;
    }

    // Evitar duplicados
    if (this.isDuplicate(level, category, message)) {
      return;
    }

    // Construir log
    const icon = this.LOG_ICONS[level];
    const color = this.LOG_COLORS[level];
    const formattedMessage = this.formatMessage(icon, level, category, message);

    // Output a console
    if (data !== null) {
      console.info(
        `%c${formattedMessage}`,
        `color: ${color}; font-weight: bold;`,
        data
      );
    } else {
      console.info(
        `%c${formattedMessage}`,
        `color: ${color}; font-weight: bold;`
      );
    }

    // Aggregate WARN+ to external services (if configured) without impacting UI.
    if (level === 'WARN' || level === 'ERROR' || level === 'CRITICAL') {
      this.reportBreadcrumb(level, category, message, data);
    }

    // Enviar a servicios externos si es error crítico
    if (level === 'ERROR' || level === 'CRITICAL') {
      this.reportError(level, category, message, data);
    }
  }

  formatMessage(icon, level, category, message) {
    return `${icon} [${level}][${category}] ${message}`;
  }

  isDuplicate(level, category, message) {
    const key = `${level}:${category}:${message}`;
    const now = Date.now();

    if (this.logCache.has(key)) {
      const lastTime = this.logCache.get(key);
      if (now - lastTime < this.deduplicationWindow) {
        return true;
      }
    }

    this.logCache.set(key, now);
    return false;
  }

  reportError(level, category, message, _data) {
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureMessage(
        `[${category}] ${message}`,
        level === 'CRITICAL' ? 'fatal' : 'error'
      );
    }
  }

  canSendBreadcrumb() {
    const now = Date.now();
    if (now - this.breadcrumbWindowStart > this.breadcrumbWindowMs) {
      this.breadcrumbWindowStart = now;
      this.breadcrumbCount = 0;
    }
    if (this.breadcrumbCount >= this.breadcrumbMaxPerWindow) return false;
    this.breadcrumbCount += 1;
    return true;
  }

  reportBreadcrumb(level, category, message, data) {
    try {
      if (typeof window === 'undefined') return;
      const sentry = window.Sentry;
      if (!sentry || typeof sentry.addBreadcrumb !== 'function') return;
      if (!this.canSendBreadcrumb()) return;

      const map = {
        WARN: 'warning',
        ERROR: 'error',
        CRITICAL: 'fatal',
      };

      sentry.addBreadcrumb({
        category: String(category || 'APP'),
        level: map[level] || 'info',
        message: String(message || ''),
        data: data && typeof data === 'object' ? data : undefined,
      });
    } catch {
      // Never let telemetry break runtime behavior.
    }
  }

  info(message, category = 'CORE', data = null) {
    this.log('INFO', category, message, data);
  }

  debug(message, category = 'CORE', data = null) {
    this.log('DEBUG', category, message, data);
  }

  warn(message, category = 'CORE', data = null) {
    this.log('WARN', category, message, data);
  }

  error(message, category = 'CORE', data = null) {
    this.log('ERROR', category, message, data);
  }

  critical(message, category = 'CORE', data = null) {
    this.log('CRITICAL', category, message, data);
  }

  trace(message, category = 'CORE', data = null) {
    this.log('TRACE', category, message, data);
  }

  perf(operation, categoryOrDuration, durationMs = null) {
    let duration = 0;
    let category = 'PERF';

    // Soporte polimórfico para (op, dur, cat) y (op, cat, dur)
    if (typeof categoryOrDuration === 'number') {
      duration = categoryOrDuration;
      category = durationMs || 'PERF';
    } else {
      category = categoryOrDuration || 'PERF';
      duration = parseFloat(durationMs);
    }

    // Si sigue sin ser número válido, advertir y salir
    if (isNaN(duration)) {
      this.warn(
        `Invalid performance duration for "${operation}": ${durationMs || categoryOrDuration}`,
        category
      );
      return;
    }

    const icon = duration > 500 ? '🐢' : '⚡';
    const message = `${operation}: ${duration.toFixed(2)}ms`;
    this.log('DEBUG', category, `${icon} ${message}`);
  }

  section(name) {
    // Suppress section groups in quiet mode
    if (this.LOG_LEVELS.DEBUG > this.config.level) {
      return () => {};
    }
    console.group(`🔧 ${name}`);
    return () => console.groupEnd();
  }

  // Alias for backward compatibility
  startGroup(name, category = '') {
    if (this.LOG_LEVELS.DEBUG > this.config.level) {
      return;
    }
    const prefix = category ? `[${category}] ` : '';
    console.group(`🔧 ${prefix}${name}`);
  }

  endGroup() {
    if (this.LOG_LEVELS.DEBUG > this.config.level) {
      return;
    }
    console.groupEnd();
  }

  clearCache() {
    this.logCache.clear();
  }

  setLevel(level) {
    if (this.LOG_LEVELS.hasOwnProperty(level)) {
      this.config.level = this.LOG_LEVELS[level];
      this.info(`Log level changed to: ${level}`, 'SYSTEM');
    }
  }

  expose() {
    if (typeof window !== 'undefined') {
      window.Logger = this;
      window.AppLogger = this;
      this.info('Logger exposed globally as window.Logger', 'SYSTEM');
    }
  }
}

// Crear instancia global
(function () {
  'use strict';
  const LoggerInstance = new UnifiedLogger();

  if (typeof window !== 'undefined') {
    window.Logger = LoggerInstance;
    window.AppLogger = LoggerInstance;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoggerInstance;
  }
})();
