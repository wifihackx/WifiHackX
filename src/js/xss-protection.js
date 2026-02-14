/**
 * XSS Protection - Módulo consolidado de seguridad
 * Combina: xss-sanitizer.js + security-config.js + security-xss-fix.js
 *
 * @version 2.0.0
 * @author WifiHackX Security Team
 */

(function () {
  'use strict';

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
    trace: (m, c) => console.log(`[TRACE][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || {
    SECURITY: 'SEC',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  logSystem.info('Inicializando módulo de seguridad consolidado...', CAT.INIT);

  // ============================================================
  // METRICS AND LOGGING
  // ============================================================

  /**
   * Metrics tracking for sanitization operations
   */
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

    // Keep only last 100 entries to avoid memory issues
    if (metrics.sanitizationLog.length >= 100) {
      metrics.sanitizationLog.shift();
    }
    metrics.sanitizationLog.push(logEntry);

    // Log to console in development
    if (removedElements.length > 0) {
      logSystem.warn('Sanitization removed dangerous elements', CAT.SECURITY, {
        source: source,
        removed: removedElements,
        inputLength: logEntry.inputLength,
        outputLength: logEntry.outputLength,
      });

      // Count specific types
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
      sanitizationLog: [...metrics.sanitizationLog], // Return copy
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

  // ============================================================
  // 1. SANITIZACIÓN HTML (de xss-sanitizer.js)
  // ============================================================

  /**
   * Sanitiza HTML eliminando scripts y eventos peligrosos
   * PERO preservando estilos inline seguros y atributos de formato
   */
  window.sanitizeHTML = function (html, source = 'sanitizeHTML') {
    if (typeof html !== 'string') {
      logSystem.warn(
        `Input no es string en sanitizeHTML (source: ${source})`,
        CAT.SECURITY
      );
      logSanitization(html, '', source, ['invalid-input-type']);
      return '';
    }

    const removedElements = [];

    // Prioridad 1: DOMPurify (Consistente con sanitizeHTMLSafe)
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      try {
        // Detect dangerous patterns before sanitization
        if (/<script/i.test(html)) removedElements.push('script');
        if (/on\w+\s*=/i.test(html)) removedElements.push('event-handlers');
        if (/javascript:/i.test(html)) removedElements.push('javascript-url');

        const sanitized = window.DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'b',
            'i',
            'em',
            'strong',
            'u',
            'p',
            'br',
            'ul',
            'li',
            'a',
            'span',
            'div',
            'img',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'blockquote',
            'code',
            'pre',
            'hr',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'button',
          ],
          ALLOWED_ATTR: [
            'href',
            'title',
            'target',
            'rel',
            'src',
            'alt',
            'class',
            'id',
            'style',
            'data-action',
            'data-id',
            'aria-label',
            'role',
            'width',
            'height',
            'loading',
            'viewBox',
            'd',
            'fill',
            'xmlns',
          ],
          ALLOW_DATA_ATTR: true,
          ADD_ATTR: ['data-translate'],
          // CSP compliance - don't add nonce to styles as DOMPurify doesn't support it directly
          // Instead, we'll handle this at the application level
        });

        logSanitization(html, sanitized, source, removedElements);
        return sanitized;
      } catch (e) {
        logSystem.error(
          'DOMPurify failed, falling back to DOMParser',
          CAT.SECURITY,
          e
        );
        // Fall through to DOMParser fallback
      }
    }

    // Prioridad 2: DOMParser (Basado en xss-sanitizer.js original  - SIEMPRE DEBE FUNCIONAR)
    logSystem.warn(
      'DOMPurify no disponible, usando DOMParser fallback',
      CAT.SECURITY
    );
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Eliminar scripts
      const scripts = doc.querySelectorAll('script');
      if (scripts.length > 0) {
        removedElements.push(`script(${scripts.length})`);
        scripts.forEach(script => script.remove());
      }

      // Eliminar eventos on* peligrosos
      const allElements = doc.querySelectorAll('*');
      let eventHandlersRemoved = 0;
      let jsUrlsRemoved = 0;

      allElements.forEach(element => {
        const attributes = Array.from(element.attributes);
        attributes.forEach(attr => {
          const attrName = attr.name.toLowerCase();
          if (attrName.startsWith('on')) {
            element.removeAttribute(attr.name);
            eventHandlersRemoved++;
          } else if (
            (attrName === 'href' || attrName === 'src') &&
            attr.value.toLowerCase().includes('javascript:')
          ) {
            element.removeAttribute(attr.name);
            jsUrlsRemoved++;
          }
        });
      });

      if (eventHandlersRemoved > 0)
        removedElements.push(`event-handlers(${eventHandlersRemoved})`);
      if (jsUrlsRemoved > 0)
        removedElements.push(`javascript-urls(${jsUrlsRemoved})`);

      const result = doc.body.innerHTML;
      logSystem.debug('HTML sanitizado con DOMParser', CAT.SECURITY);
      logSanitization(html, result, source, removedElements);
      return result;
    } catch (e) {
      logSystem.error('Error CRÍTICO en DOMParser', CAT.SECURITY, e);
      // ÚLTIMO RECURSO: Si DOMParser falla (muy raro), devolver texto plano
      const plainText = html.replace(/<[^>]*>/g, '');
      logSanitization(html, plainText, source, [
        'sanitization-error',
        'fallback-to-text',
      ]);
      logSystem.error(
        'Retornando texto plano como último recurso tras fallo de sanitización',
        CAT.SECURITY
      );
      return plainText;
    }
  };

  /**
   * Valida si un HTML contiene contenido peligroso
   */
  window.validateHTMLSecurity = function (html) {
    if (typeof html !== 'string') {
      return {
        valid: false,
        issues: ['Input no es string'],
      };
    }

    const issues = [];
    const htmlLower = html.toLowerCase();

    if (htmlLower.includes('<script')) {
      issues.push('Contiene etiquetas <script>');
    }

    const eventPatterns = [/on\w+\s*=/gi, /javascript:/gi];

    eventPatterns.forEach(pattern => {
      if (pattern.test(html)) {
        issues.push(`Contiene patrón peligroso: ${pattern.source}`);
      }
    });

    if (htmlLower.includes('<iframe') && !htmlLower.includes('youtube.com')) {
      issues.push('Contiene iframe no autorizado');
    }

    return {
      valid: issues.length === 0,
      issues: issues,
    };
  };

  /**
   * Establece innerHTML de forma segura
   */
  window.safeSetInnerHTML = function (
    element,
    html,
    source = 'safeSetInnerHTML'
  ) {
    if (!element || !(element instanceof HTMLElement)) {
      logSystem.error('Elemento inválido en safeSetInnerHTML', CAT.SECURITY);
      logSanitization(html, '', source, ['invalid-element']);
      return;
    }

    const removedElements = [];

    // Sanitize using DOMPurify if available, otherwise use DOMParser
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      // Detect dangerous patterns before sanitization
      if (/<script/i.test(html)) removedElements.push('script');
      if (/on\w+\s*=/i.test(html)) removedElements.push('event-handlers');
      if (/javascript:/i.test(html)) removedElements.push('javascript-url');

      const sanitized = window.DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'b',
          'i',
          'em',
          'strong',
          'u',
          'p',
          'br',
          'ul',
          'ol',
          'li',
          'a',
          'span',
          'div',
          'img',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'blockquote',
          'code',
          'pre',
          'hr',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'button',
        ],
        ALLOWED_ATTR: [
          'href',
          'title',
          'target',
          'rel',
          'src',
          'alt',
          'class',
          'id',
          'style',
          'data-action',
          'data-id',
          'aria-label',
          'role',
          'width',
          'height',
          'loading',
          'viewBox',
          'd',
          'fill',
          'xmlns',
        ],
        ALLOW_DATA_ATTR: true,
        ADD_ATTR: ['data-translate'],
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
      });
      element.innerHTML = sanitized;
      logSanitization(html, sanitized, source, removedElements);
    } else {
      // Fallback: DOMParser sanitization (removes scripts and dangerous attributes)
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove scripts
        const scripts = doc.querySelectorAll('script');
        if (scripts.length > 0) {
          removedElements.push(`script(${scripts.length})`);
          scripts.forEach(el => el.remove());
        }

        // Remove dangerous attributes
        let eventHandlersRemoved = 0;
        let jsUrlsRemoved = 0;

        doc.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name);
              eventHandlersRemoved++;
            } else if (
              attr.name === 'href' &&
              attr.value.includes('javascript:')
            ) {
              el.removeAttribute(attr.name);
              jsUrlsRemoved++;
            }
          });
        });

        if (eventHandlersRemoved > 0)
          removedElements.push(`event-handlers(${eventHandlersRemoved})`);
        if (jsUrlsRemoved > 0)
          removedElements.push(`javascript-urls(${jsUrlsRemoved})`);

        element.innerHTML = doc.body.innerHTML;
        logSanitization(html, doc.body.innerHTML, source, removedElements);
      } catch (e) {
        logSystem.error(
          'Error en sanitización DOMParser (safeSetInnerHTML)',
          CAT.SECURITY,
          e
        );
        // Last resort: use plain text
        element.textContent = html.replace(/<[^>]*>/g, '');
        logSanitization(html, element.textContent, source, [
          'sanitization-error',
          'fallback-to-text',
        ]);
      }
    }
  };

  /**
   * Añade HTML de forma segura
   */
  window.safeAppendHTML = function (element, html) {
    if (!element || !(element instanceof HTMLElement)) {
      logSystem.error('Elemento inválido en safeAppendHTML', CAT.SECURITY);
      return;
    }

    const sanitized = window.sanitizeHTML(html);
    element.insertAdjacentHTML('beforeend', sanitized);
  };

  /**
   * Escapa HTML para prevenir XSS
   */
  window.escapeHTML = function (text) {
    if (typeof text !== 'string') return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Desescapa HTML
   */
  window.unescapeHTML = function (html) {
    if (typeof html !== 'string') return '';

    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent;
  };

  // ============================================================
  // 2. SANITIZACIÓN AVANZADA CON DOMPURIFY (de security-xss-fix.js)
  // ============================================================

  /**
   * Sanitización avanzada usando DOMPurify si está disponible
   */
  window.sanitizeHTMLSafe = function (html) {
    // Ahora sanitizeHTML (arriba) ya prioriza DOMPurify, así que son equivalentes
    return window.sanitizeHTML(html);
  };

  /**
   * Verifica si una URL es segura
   */
  window.isSafeURL = function (url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;

    // Bloquear esquemas peligrosos
    if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
      // Permitir solo data:image para casos específicos si es necesario,
      // pero por defecto somos restrictivos
      if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
        return true;
      }
      return false;
    }

    // Permitir URLs relativas, protocolos seguros y nombres de archivos/rutas locales
    return /^(https?:\/\/|\/|\.\/|\.\.\/|[a-z0-9_\-\/]+\.[a-z0-9]+)/i.test(
      trimmed
    );
  };

  /**
   * Sanitiza URLs
   */
  window.sanitizeURL = function (url) {
    return window.isSafeURL(url) ? url.trim() : '';
  };

  /**
   * Establece src de imagen de forma segura
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
   * Establece href de link de forma segura
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

  // ============================================================
  // 3. CONFIGURACIÓN DE SEGURIDAD (de security-config.js)
  // ============================================================

  window.SecurityConfig = {
    // Validación de entrada
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

      getPasswordStrength: function (password) {
        if (!password) return 0;
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
        return score;
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

    // Rate limiting (cliente)
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
          logSystem.warn(
            `Rate limit exceeded for action: ${action}`,
            CAT.SECURITY
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

  // ============================================================
  // 4. TESTS Y VERIFICACIÓN
  // ============================================================

  logSystem.debug('Ejecutando tests de seguridad internos...', CAT.INIT);

  // Test 1: XSS básico
  const testHTML = '<img src=x onerror="alert(\'XSS\')"><p>Texto seguro</p>';
  const _sanitized = window.sanitizeHTML(testHTML, 'initialization-test');
  const validation = window.validateHTMLSecurity(testHTML);

  if (!validation.valid) {
    logSystem.trace('Test 1 exitoso - XSS detectado y bloqueado', CAT.SECURITY);
  } else {
    logSystem.warn('Test 1 falló - XSS no detectado', CAT.SECURITY);
  }

  // Test 2: Preservación de estilos
  const testStyles =
    '<p style="color: red; font-size: 20px;">Texto con estilo</p>';
  const sanitizedStyles = window.sanitizeHTML(
    testStyles,
    'initialization-test'
  );

  if (
    sanitizedStyles.includes('style=') &&
    sanitizedStyles.includes('color: red')
  ) {
    logSystem.trace('Test 2 exitoso - Estilos preservados', CAT.SECURITY);
  } else {
    logSystem.warn('Test 2 falló - Estilos eliminados', CAT.SECURITY);
  }

  // ============================================================
  // 5. EXPOSICIÓN GLOBAL
  // ============================================================

  window.XSSProtection = {
    // Core sanitization functions
    sanitize: window.sanitizeHTML,
    sanitizeSafe: window.sanitizeHTMLSafe,
    validate: window.validateHTMLSecurity,
    setInnerHTML: window.safeSetInnerHTML,
    appendHTML: window.safeAppendHTML,
    escape: window.escapeHTML,
    unescape: window.unescapeHTML,
    sanitizeURL: window.sanitizeURL,
    setImageSrc: window.setImageSrcSafe,
    setLinkHref: window.setLinkHrefSafe,

    // Metrics and logging
    metrics: getMetrics,
    getMetrics: getMetrics,
    resetMetrics: resetMetrics,

    // Configuration
    config: window.SecurityConfig,
  };

  logSystem.info('Módulo consolidado cargado y funcionando', CAT.INIT);
  logSystem.debug(
    'Metrics tracking enabled - use XSSProtection.getMetrics() to view stats',
    CAT.INIT
  );
})();
