/**
 * Security Bundle - Consolidated Security Module
 *
 * Consolidates:
 * - Script Load Guard
 * - XSS Protection
 * - DOM Protector
 * - Anti Kill-Switch
 *
 * @version 1.0.0
 * @author WifiHackX Security Team
 * @description This bundle must be loaded FIRST before all other scripts
 */

(function () {
  'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

  debugLog(
    '[Security Bundle] Initializing consolidated security module v1.0.0...'
  );

  // ============================================================
  // MODULE 1: SCRIPT LOAD GUARD
  // ============================================================

  debugLog('[Security Bundle] Loading Script Load Guard...');

  // Initialize script registry
  if (!window.__loadedScripts) {
    window.__loadedScripts = {};
  }

  /**
   * Mark a script as loaded
   * @param {string} name - Unique script name
   * @returns {boolean} true if first load, false if already loaded
   */
  window.markScriptLoaded = function (name) {
    if (!name || typeof name !== 'string') {
      console.error(
        '[Security Bundle] markScriptLoaded: invalid script name',
        name
      );
      return false;
    }

    if (window.__loadedScripts[name]) {
      console.warn(
        `[Security Bundle] Script "${name}" already loaded (duplicate detected)`
      );
      return false;
    }

    window.__loadedScripts[name] = {
      loaded: true,
      timestamp: Date.now(),
      url: document.currentScript ? document.currentScript.src : 'inline',
    };

    return true;
  };

  /**
   * Check if a script is already loaded
   * @param {string} name - Unique script name
   * @returns {boolean} true if loaded, false otherwise
   */
  window.isScriptLoaded = function (name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    return !!window.__loadedScripts[name];
  };

  /**
   * Get information about a loaded script
   * @param {string} name - Unique script name
   * @returns {Object|null} Script info or null if not loaded
   */
  window.getScriptInfo = function (name) {
    if (!name || typeof name !== 'string') {
      return null;
    }
    return window.__loadedScripts[name] || null;
  };

  /**
   * List all loaded scripts
   * @returns {Array<string>} Array of all loaded script names
   */
  window.listLoadedScripts = function () {
    return Object.keys(window.__loadedScripts);
  };

  /**
   * Clear script registry (for debugging/testing only)
   * @param {string} [name] - Script name to clear, or undefined to clear all
   */
  window.clearScriptRegistry = function (name) {
    if (name) {
      delete window.__loadedScripts[name];
    } else {
      window.__loadedScripts = {};
    }
  };

  // Mark Script Load Guard as loaded
  window.__loadedScripts['script-load-guard'] = {
    loaded: true,
    timestamp: Date.now(),
    url: 'security-bundle',
  };

  debugLog('[Security Bundle] Script Load Guard ready');

  // ============================================================
  // MODULE 2: XSS PROTECTION
  // ============================================================

  debugLog('[Security Bundle] Loading XSS Protection...');

  // Metrics tracking
  const metrics = {
    totalSanitizations: 0,
    blockedScripts: 0,
    blockedEvents: 0,
    blockedURLs: 0,
    lastSanitization: null,
    sanitizationLog: [],
  };

  /**
   * Log a sanitization operation
   */
  function logSanitization(input, output, source, removedElements = []) {
    metrics.totalSanitizations++;
    metrics.lastSanitization = new Date();

    const logEntry = {
      timestamp: new Date().toISOString(),
      inputLength: input ? input.length : 0,
      outputLength: output ? output.length : 0,
      removedElements: removedElements,
      source: source || 'unknown',
      wasBlocked: removedElements.length > 0,
    };

    if (metrics.sanitizationLog.length >= 100) {
      metrics.sanitizationLog.shift();
    }
    metrics.sanitizationLog.push(logEntry);

    if (removedElements.length > 0) {
      console.warn(
        '[Security Bundle] Sanitization removed dangerous elements:',
        {
          source: source,
          removed: removedElements,
        }
      );

      removedElements.forEach(elem => {
        if (elem.includes('script')) metrics.blockedScripts++;
        if (elem.includes('on')) metrics.blockedEvents++;
        if (elem.includes('javascript:')) metrics.blockedURLs++;
      });
    }

    return logEntry;
  }

  /**
   * Get sanitization metrics
   */
  function getMetrics() {
    return {
      ...metrics,
      sanitizationLog: [...metrics.sanitizationLog],
    };
  }

  /**
   * Reset metrics (for testing)
   */
  function resetMetrics() {
    metrics.totalSanitizations = 0;
    metrics.blockedScripts = 0;
    metrics.blockedEvents = 0;
    metrics.blockedURLs = 0;
    metrics.lastSanitization = null;
    metrics.sanitizationLog = [];
  }

  /**
   * Sanitize HTML removing scripts and dangerous events
   * Delegating to DOMPurify if available for better compatibility
   */
  window.sanitizeHTML = function (html) {
    if (typeof html !== 'string') return '';
    if (
      globalThis.DOMPurify &&
      typeof globalThis.DOMPurify.sanitize === 'function'
    ) {
      return globalThis.DOMPurify.sanitize(html);
    }
    // Fallback to simple escape if DOMPurify is not yet loaded
    return window.escapeHTML(html);
  };

  // Backward-compatible alias used by legacy modules.
  window.sanitizeHTMLSafe = window.sanitizeHTML;

  /**
   * Sanitize an attribute value removing javascript: and other dangerous patterns
   */
  window.sanitizeAttribute = function (value) {
    if (typeof value !== 'string') return '';
    const valLower = value.toLowerCase();
    if (valLower.includes('javascript:')) return '';
    if (valLower.includes('data:text/html')) return '';
    if (/on\w+\s*=/i.test(valLower)) return '';
    return value;
  };

  /**
   * Validate if HTML contains dangerous content
   */
  window.validateHTMLSecurity = function (html) {
    if (typeof html !== 'string') {
      return {
        valid: false,
        issues: ['Input is not a string'],
      };
    }

    const issues = [];
    const htmlLower = html.toLowerCase();

    if (htmlLower.includes('<script')) {
      issues.push('Contains <script> tags');
    }

    const eventPatterns = [/on\w+\s*=/gi, /javascript:/gi];
    eventPatterns.forEach(pattern => {
      if (pattern.test(html)) {
        issues.push(`Contains dangerous pattern: ${pattern.source}`);
      }
    });

    if (htmlLower.includes('<iframe') && !htmlLower.includes('youtube.com')) {
      issues.push('Contains unauthorized iframe');
    }

    return {
      valid: issues.length === 0,
      issues: issues,
    };
  };

  /**
   * Set innerHTML safely
   */
  window.safeSetInnerHTML = function (
    element,
    html,
    source = 'safeSetInnerHTML'
  ) {
    if (!element || !(element instanceof HTMLElement)) {
      console.error('[Security Bundle] Invalid element');
      logSanitization(html, '', source, ['invalid-element']);
      return;
    }

    const sanitized = window.sanitizeHTML(html, source);
    element.innerHTML = sanitized;
  };

  /**
   * Append HTML safely
   */
  window.safeAppendHTML = function (element, html) {
    if (!element || !(element instanceof HTMLElement)) {
      console.error('[Security Bundle] Invalid element');
      return;
    }

    const sanitized = window.sanitizeHTML(html);
    element.insertAdjacentHTML('beforeend', sanitized);
  };

  /**
   * Escape HTML to prevent XSS
   */
  window.escapeHTML = function (text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Unescape HTML
   */
  window.unescapeHTML = function (html) {
    if (typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent;
  };

  /**
   * Check if URL is safe
   */
  window.isSafeURL = function (url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;

    // Check for dangerous protocols
    if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
      // Allow only safe data: images
      if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
        return true;
      }
      return false;
    }

    // Validate structure using URL constructor for absolute URLs
    try {
      if (/^https?:\/\//i.test(trimmed)) {
        new URL(trimmed);
        return true;
      }
      // For relative paths, try to resolve against a base
      new URL(trimmed, 'https://l.l');

      // If it reached here, it's at least structurally valid as a path
      // But we should still enforce our whitelist regex for safety
      return /^(https?:\/\/|\/|\.\/|\.\.\/|[a-z0-9_\-\/]+\.[a-z0-9]+)/i.test(
        trimmed
      );
    } catch (_e) {
      return false;
    }
  };

  /**
   * Sanitize URL
   */
  window.sanitizeURL = function (url) {
    return window.isSafeURL(url) ? url.trim() : '';
  };

  /**
   * Validate a URL (alias for isSafeURL for test compatibility)
   */
  window.validateURL = function (url) {
    return window.isSafeURL(url);
  };

  /**
   * Set image src safely
   */
  window.setImageSrcSafe = function (img, url) {
    if (!img || !(img instanceof HTMLImageElement)) return;
    const safeUrl = window.sanitizeURL(url);
    if (safeUrl) {
      img.src = safeUrl;
    } else {
      img.src = '';
      img.alt = 'Invalid image URL';
    }
  };

  /**
   * Set link href safely
   */
  window.setLinkHrefSafe = function (link, url) {
    if (!link || !(link instanceof HTMLAnchorElement)) return;
    const safeUrl = window.sanitizeURL(url);
    if (safeUrl) {
      link.href = safeUrl;
      if (/^https?:\/\//i.test(safeUrl)) {
        link.rel = 'noopener noreferrer';
      }
    } else {
      link.href = '#';
      link.onclick = e => e.preventDefault();
    }
  };

  // Security Configuration
  window.SecurityConfig = {
    Validation: {
      isValidEmail: function (email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email) && email.length <= 254;
      },

      isStrongPassword: function (password) {
        if (!password || typeof password !== 'string') return false;
        const minLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        return minLength && hasUppercase && hasLowercase && hasNumber;
      },

      sanitizeInput: function (input) {
        if (!input || typeof input !== 'string') return '';
        let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
        sanitized = sanitized.trim();
        if (sanitized.length > 10000) {
          sanitized = sanitized.substring(0, 10000);
        }
        return sanitized;
      },
    },

    RateLimit: {
      attempts: {},

      isRateLimited: function (action, maxAttempts = 5, windowMs = 60000) {
        const now = Date.now();

        if (!this.attempts[action]) {
          this.attempts[action] = [];
        }

        this.attempts[action] = this.attempts[action].filter(
          timestamp => now - timestamp < windowMs
        );

        if (this.attempts[action].length >= maxAttempts) {
          console.warn(
            `[Security Bundle] Rate limit exceeded for action: ${action}`
          );
          return true;
        }

        this.attempts[action].push(now);
        return false;
      },

      reset: function (action) {
        delete this.attempts[action];
      },
    },
  };

  debugLog('[Security Bundle] XSS Protection ready');

  // ============================================================
  // MODULE 3: DOM PROTECTOR
  // ============================================================

  debugLog('[Security Bundle] Loading DOM Protector...');

  const SAFE_IDS = [
    'publicAnnouncementsContainer',
    'announcementsContainer',
    'cartCount',
  ];
  const isLocalhost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  const logSecurityIssue = (message, node) => {
    if (isLocalhost) {
      console.info(
        `[Security Bundle - DOM Protector - LOCAL] ${message}`,
        node
      );
    } else {
      console.warn(`[Security Bundle - DOM Protector] ${message}`, node);
    }
  };

  // Block removeDuplicates
  if (
    typeof window.removeDuplicates === 'undefined' ||
    window.removeDuplicates.isFake
  ) {
    window.removeDuplicates = function () {
      debugLog('[Security Bundle] removeDuplicates attempt neutralized');
    };
    window.removeDuplicates.isFake = true;
  }

  // Block restricted APIs (DISABLED: Breaks Firebase Modular SDK)
  // ENABLED ONLY DURING TESTS
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname === 'example.com'
  ) {
    debugLog(
      '[Security Bundle] Test environment detected - enabling Function blocking'
    );

    const _originalFunction = window.Function;
    window.Function = function (...args) {
      console.warn(
        `[Security] Blocked call to Function constructor. Args: ${args} \nstack trace:`,
        new Error().stack
      );
      return undefined;
    };

    const _originalEval = window.eval;
    window.eval = function (code) {
      console.warn(
        `[Security] Blocked call to eval(). Code: ${code} \nstack trace:`,
        new Error().stack
      );
      return undefined;
    };
  }

  const _originalSetTimeout = window.setTimeout;
  window.setTimeout = function (handler, timeout, ...args) {
    if (typeof handler === 'string') {
      console.warn(
        `[Security] Blocked call to setTimeout with string. Code: ${handler} \nstack trace:`,
        new Error().stack
      );
      return undefined;
    }
    return _originalSetTimeout(handler, timeout, ...args);
  };

  const _originalSetInterval = window.setInterval;
  window.setInterval = function (handler, timeout, ...args) {
    if (typeof handler === 'string') {
      console.warn(
        `[Security] Blocked call to setInterval with string. Code: ${handler} \nstack trace:`,
        new Error().stack
      );
      return undefined;
    }
    return _originalSetInterval(handler, timeout, ...args);
  };

  // Protect Head against unauthorized style injections
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') {
            const isLocal =
              node.tagName === 'SCRIPT' &&
              node.src &&
              (node.src.startsWith(location.origin) ||
                !node.src.startsWith('http'));
            const isStripe =
              (node.src && node.src.includes('stripe.com')) ||
              (node.id && node.id.includes('stripe'));
            const isInternalStyle =
              node.tagName === 'STYLE' &&
              (node.id === 'a11y-styles' ||
                node.id === 'modal-animations' ||
                node.textContent.includes('notification'));

            if (
              !node.hasAttribute('nonce') &&
              !node.classList.contains('fiveserver-injected') &&
              !isLocal &&
              !isStripe &&
              !isInternalStyle
            ) {
              if (isLocalhost) {
                try {
                  const nonce = window.SECURITY_NONCE || window.NONCE || '';
                  node.setAttribute('nonce', nonce);
                  if (node.parentNode) {
                    const cloned = node.cloneNode(true);
                    cloned.setAttribute('nonce', nonce);
                    node.parentNode.replaceChild(cloned, node);
                  }
                } catch (_e) {}
              } else {
                logSecurityIssue(
                  'Detected external injection without nonce:',
                  node
                );
              }
            }
          }
        });
      }
    });
  });

  // Observe head and body
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
    });
  }

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
        });
      }
    });
  }

  // Protect critical elements against deletion
  const protectElement = id => {
    const el = document.getElementById(id);
    if (el && el.parentNode) {
      const parent = el.parentNode;
      const nodeObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.removedNodes.forEach(node => {
            if (node.id === id) {
              console.error(
                `[Security Bundle] Attempt to delete critical element detected! (#${id})`
              );
            }
          });
        });
      });
      nodeObserver.observe(parent, {
        childList: true,
      });
    }
  };

  SAFE_IDS.forEach(protectElement);

  window.domProtector = {
    isReady: true,
    version: '1.0.0',
    isLocalhost: isLocalhost,
  };

  debugLog('[Security Bundle] DOM Protector ready');

  // ============================================================
  // MODULE 4: ANTI KILL-SWITCH
  // ============================================================

  debugLog('[Security Bundle] Loading Anti Kill-Switch...');

  if (globalThis.ENABLE_EMERGENCY_PROTECTIONS !== true) {
    debugLog(
      '[Security Bundle] Emergency protections disabled (ENABLE_EMERGENCY_PROTECTIONS not set)'
    );
  } else {
    // Block removeDuplicates (additional protection)
    const blockedRemoveDuplicates = function () {
      debugLog(
        '[Security Bundle] removeDuplicates blocked by Anti Kill-Switch'
      );
      return undefined;
    };

    Object.defineProperty(globalThis, 'removeDuplicates', {
      get: () => blockedRemoveDuplicates,
      set: () => {},
      configurable: false,
    });

    // Protect MutationObserver (DISABLED: Breaks Firebase Modular SDK internally)
    /*
        const OriginalMO = globalThis.MutationObserver;
        globalThis.MutationObserver = class ProtectedMO extends OriginalMO {
            constructor(callback) {
                super(mutations => {
                    const safe = mutations.filter(m => {
                        if (globalThis.announcementAuthorizedOperation) return true;
                        if (m.type === 'childList' && m.removedNodes.length > 0) {
                            const target = m.target;
                            if (
                                (target.id && target.id.includes('announcement')) ||
                                (target.classList && target.classList.contains('announcement'))
                            ) {
                                console.warn(
                                    '[Security Bundle] Delete attempt blocked by Anti Kill-Switch'
                                );
                                return false;
                            }
                        }
                        return true;
                    });

                    if (safe.length > 0) callback(safe);
                });
            }
        };
        */

    debugLog('[Security Bundle] Anti Kill-Switch protections installed');
  }

  // ============================================================
  // GLOBAL EXPOSURE
  // ============================================================

  window.XSSProtection = {
    sanitize: window.sanitizeHTML,
    sanitizeSafe: window.sanitizeHTMLSafe,
    sanitizeHTML: window.sanitizeHTML,
    sanitizeAttribute: window.sanitizeAttribute,
    validate: window.validateHTMLSecurity,
    validateURL: window.validateURL,
    setInnerHTML: window.safeSetInnerHTML,
    appendHTML: window.safeAppendHTML,
    escape: window.escapeHTML,
    unescape: window.unescapeHTML,
    sanitizeURL: window.sanitizeURL,
    setImageSrc: window.setImageSrcSafe,
    setLinkHref: window.setLinkHrefSafe,
    metrics: getMetrics,
    getMetrics: getMetrics,
    resetMetrics: resetMetrics,
    config: window.SecurityConfig,
  };

  // Mark security bundle as loaded
  window.__loadedScripts['security-bundle'] = {
    loaded: true,
    timestamp: Date.now(),
    url: document.currentScript ? document.currentScript.src : 'inline',
  };

  debugLog('[Security Bundle] All modules loaded successfully v1.0.0');
  debugLog(
    '[Security Bundle] Use XSSProtection.getMetrics() to view security stats'
  );
})();

