// Merged DOMUtils - Ensures compatibility between core.js and dom-helpers.js
(function () {
  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true) {
      console.log(...args);
    }
  };
  const existingDOMUtils = window.DOMUtils || {};

  const newDOMUtils = {
    // Script loader for lazy loading
    loadScript: function (src, nonce = '') {
      debugLog('DOMUtils.loadScript called with src:', src, 'nonce:', nonce);
      if (typeof src === 'object' && src !== null) {
        nonce = src.nonce || nonce;
        src = src.src || '';
      }
      return new Promise((resolve, reject) => {
        if (!src || typeof src !== 'string') {
          console.error('Invalid script source:', src);
          reject(new Error('Invalid script source'));
          return;
        }

        // Clear query params for file:// protocol if desired, but here we keep them
        // unless we find they are causing total failure.

        if (document.querySelector(`script[src="${src}"]`)) {
          debugLog('Script already loaded:', src);
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        if (nonce) script.nonce = nonce;
        script.onload = resolve;
        script.onerror = e => {
          console.error('Error loading script:', src, e);
          reject(e);
        };
        document.head.appendChild(script);
      });
    },

    // Load multiple scripts
    loadScripts: function (scripts) {
      debugLog('DOMUtils.loadScripts called with scripts:', scripts);
      if (!Array.isArray(scripts)) return Promise.resolve();
      return Promise.all(
        scripts.map(s => {
          const src = typeof s === 'string' ? s : s.src || s;
          const nonce = typeof s === 'object' ? s.nonce || '' : '';
          return this.loadScript(src, nonce);
        })
      );
    },

    initLucideIcons: function () {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    },

    // Sanitiza HTML
    sanitizeHTML: function (input) {
      if (
        typeof window.XSSProtection !== 'undefined' &&
        window.XSSProtection.sanitize
      ) {
        return window.XSSProtection.sanitize(input);
      }
      // Fallback basic sanitization
      try {
        if (typeof input !== 'string') return '';
        const template = document.createElement('template');
        template.innerHTML = input;
        const allowedTags = new Set([
          'b',
          'i',
          'strong',
          'em',
          'u',
          'br',
          'ul',
          'ol',
          'li',
          'p',
          'span',
          'a',
        ]);
        const walker = document.createTreeWalker(
          template.content,
          NodeFilter.SHOW_ELEMENT,
          null
        );
        const toRemove = [];
        while (walker.nextNode()) {
          const el = walker.currentNode;
          if (!allowedTags.has(el.tagName.toLowerCase())) {
            toRemove.push(el);
          }
        }
        toRemove.forEach(n =>
          n.replaceWith(document.createTextNode(n.textContent || ''))
        );
        return template.innerHTML;
      } catch (_e) {
        return input || '';
      }
    },

    // Alias for compatibility with admin-settings.js
    sanitize: function (input) {
      return this.sanitizeHTML(input);
    },

    // Notification system
    showNotification: function (message, type = 'info') {
      if (
        typeof NotificationSystem !== 'undefined' &&
        NotificationSystem.show
      ) {
        return NotificationSystem.show(message, type);
      }
      if (existingDOMUtils.showNotification) {
        return existingDOMUtils.showNotification(message, type);
      }
      debugLog(`[${type.toUpperCase()}] ${message}`);
    },

    createElement: function (tag, className = '', text = '') {
      // Priority to core.js version if it's more flexible,
      // but here we merge logic.
      if (
        existingDOMUtils.createElement &&
        typeof tag === 'string' &&
        arguments.length === 2 &&
        typeof className === 'object'
      ) {
        // core.js style: createElement(tag, attrs)
        return existingDOMUtils.createElement(tag, className);
      }

      try {
        const element = document.createElement(tag || 'div');
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
      } catch (_e) {
        return document.createElement('div');
      }
    },

    clearElement: function (element) {
      if (element) element.innerHTML = '';
    },

    setDisplay: function (element, display) {
      if (!element || !element.classList) return;
      const classes = [
        'hidden',
        'visible',
        'visible-flex',
        'visible-grid',
        'visible-inline',
        'visible-inline-block',
        'inline-flex',
        'inline-block',
        'block',
        'flex',
        'grid',
      ];
      classes.forEach(cls => element.classList.remove(cls));

      if (display === null || display === undefined || display === '') return;

      if (display === 'none') {
        element.classList.add('hidden');
        return;
      }

      const map = {
        block: 'visible',
        flex: 'visible-flex',
        grid: 'visible-grid',
        inline: 'visible-inline',
        'inline-block': 'visible-inline-block',
        'inline-flex': 'inline-flex',
      };
      const cls = map[display] || '';
      if (cls) {
        element.classList.add(cls);
      }
    },

    setVisibility: function (element, visible) {
      if (!element || !element.classList) return;
      element.classList.toggle('invisible', !visible);
    },

    setOpacityClass: function (element, opacity) {
      if (!element || !element.classList) return;
      const classes = ['opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100'];
      classes.forEach(cls => element.classList.remove(cls));
      const map = {
        '0': 'opacity-0',
        '0.25': 'opacity-25',
        '0.5': 'opacity-50',
        '0.7': 'opacity-75',
        '0.75': 'opacity-75',
        '1': 'opacity-100',
      };
      const cls = map[String(opacity)] || '';
      if (cls) element.classList.add(cls);
    },

    toggleVisibility: function (element, isVisible, display = 'block') {
      if (!element) return;
      this.setDisplay(element, isVisible ? display : 'none');
    },

    lockBodyScroll: function (locked) {
      if (!document || !document.body) return;
      document.body.classList.toggle('overflow-hidden', Boolean(locked));
    },

    // Component Lifecycle Manager for unified generator initialization
    ComponentLifecycle: {
      init: function (config) {
        const {
          name = 'Component',
          containerId,
          renderFn,
          onComplete,
          useMutationObserver = true,
        } = config;

        const attemptRender = () => {
          const container = document.getElementById(containerId);
          if (container) {
            debugLog(`[${name}] Container found, rendering...`);
            renderFn(container);
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
              lucide.createIcons();
            }
            if (onComplete) onComplete();
            return true;
          }
          return false;
        };

        // Try immediate render
        if (attemptRender()) return;

        // Try on DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
          if (attemptRender()) return;

          // Final fallback: MutationObserver
          if (useMutationObserver) {
            debugLog(`[${name}] Container not found, starting observer...`);
            const observer = new MutationObserver((mutations, obs) => {
              if (attemptRender()) obs.disconnect();
            });
            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });

            // Safety timeout
            setTimeout(() => observer.disconnect(), 5000);
          }
        });
      },
    },
  };

  // Merge everything else from existing DOMUtils
  window.DOMUtils = Object.assign({}, existingDOMUtils, newDOMUtils);
  debugLog('✅ [DOMUtils] Unified and loaded');
})();
