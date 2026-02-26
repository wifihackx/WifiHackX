/**
 * log-sanitizer.js
 * Intercepta y sanitiza los logs de consola para proteger datos sensibles.
 */
(function () {
  'use strict';

  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalError = console.error;
  var originalInfo = console.info;

  var REDACTION_PATTERNS = [
    { regex: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g, replacement: '[EMAIL PROTECTED]' },
    { regex: /pk_test_[a-zA-Z0-9]{24,}/g, replacement: 'pk_test_***' },
    { regex: /sk_test_[a-zA-Z0-9]{24,}/g, replacement: 'sk_test_***' },
    { regex: /\b[a-zA-Z0-9]{28}\b/g, replacement: '[UID REDACTED]' },
    { regex: /(apiKey|token|secret|key|auth)=[^&"'\s]+/gi, replacement: '$1=[REDACTED]' },
  ];

  function sanitizeArg(arg) {
    if (typeof arg === 'string') {
      var sanitized = arg;
      for (var i = 0; i < REDACTION_PATTERNS.length; i += 1) {
        var pattern = REDACTION_PATTERNS[i];
        sanitized = sanitized.replace(pattern.regex, pattern.replacement);
      }
      return sanitized;
    }

    if (arg && typeof arg === 'object') {
      try {
        if (Array.isArray(arg)) {
          var out = [];
          for (var j = 0; j < arg.length; j += 1) {
            out.push(sanitizeArg(arg[j]));
          }
          return out;
        }

        var sensitiveKeys = {
          email: true,
          password: true,
          token: true,
          apikey: true,
          secret: true,
          key: true,
        };

        var modified = false;
        var clone = null;

        for (var key in arg) {
          if (!Object.prototype.hasOwnProperty.call(arg, key)) continue;

          var lowerKey = String(key).toLowerCase();
          if (sensitiveKeys[lowerKey] && typeof arg[key] === 'string') {
            if (!clone) {
              clone = {};
              for (var k in arg) {
                if (Object.prototype.hasOwnProperty.call(arg, k)) {
                  clone[k] = arg[k];
                }
              }
            }
            clone[key] = '[REDACTED]';
            modified = true;
          }
        }

        return modified ? clone : arg;
      } catch (_e) {
        return arg;
      }
    }

    return arg;
  }

  function createWrapper(originalFunc) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var sanitizedArgs = [];
      for (var i = 0; i < args.length; i += 1) {
        sanitizedArgs.push(sanitizeArg(args[i]));
      }
      originalFunc.apply(console, sanitizedArgs);
    };
  }

  function shouldSuppressWarn(args) {
    try {
      var parts = [];
      for (var i = 0; i < args.length; i += 1) {
        var arg = args[i];
        if (typeof arg === 'string') {
          parts.push(arg);
        } else {
          try {
            parts.push(JSON.stringify(arg));
          } catch (_e) {
            parts.push(String(arg));
          }
        }
      }

      var text = parts.join(' ').toLowerCase();
      var suppressedPatterns = [
        'mfa requerida para admin view',
        'acceso denegado a security_logs',
        'sin permisos para leer diagnosticos',
        'sin permisos para leer diagn\u00f3sticos',
        'sin permisos para leer alerts',
      ];

      for (var i2 = 0; i2 < suppressedPatterns.length; i2 += 1) {
        if (text.indexOf(suppressedPatterns[i2]) !== -1) return true;
      }
      return false;
    } catch (_e2) {
      return false;
    }
  }

  var isDebugEnabled = false;
  try {
    var qs = new URLSearchParams(window.location.search || '');
    if (qs.get('debug_logs') === '1') {
      isDebugEnabled = true;
    } else if (window.__WIFIHACKX_DEBUG__ === true) {
      isDebugEnabled = true;
    } else {
      isDebugEnabled = localStorage.getItem('wifihackx:debug:logs') === '1';
    }
  } catch (_e3) {
    isDebugEnabled = false;
  }

  console.log = isDebugEnabled ? createWrapper(originalLog) : function () {};
  console.info = isDebugEnabled ? createWrapper(originalInfo) : function () {};

  var wrappedWarn = createWrapper(originalWarn);
  console.warn = function () {
    var args = Array.prototype.slice.call(arguments);
    if (!isDebugEnabled && shouldSuppressWarn(args)) return;
    wrappedWarn.apply(console, args);
  };

  console.error = createWrapper(originalError);
})();
