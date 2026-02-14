/**
 * IconManager - Official Module
 * Manages icon initialization and ensures Lucide icons are ready
 *
 * Replaces legacy cart-icon-fix.js implementation
 * @version 1.0.0
 * @author WifiHackX Team
 */

'use strict';

function setupIconManager() {

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || {
    UI: 'UI',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  class IconManager {
    constructor() {
      this.lucideReady = false;
      this._lucideWrapped = false;
      this.readyPromise = this.waitForLucide();
    }

    /**
     * Wait for Lucide library to be available
     * @returns {Promise<void>}
     */
    async waitForLucide() {
      if (window.lucide) {
        this.lucideReady = true;
        this.wrapLucideCreateIcons();
        return;
      }

      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.lucide) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            this.lucideReady = true;
            logSystem.debug('Lucide library ready', CAT.UI);
            this.wrapLucideCreateIcons();
            resolve();
          }
        }, 50);

        // Timeout after 5 seconds
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          logSystem.warn('Lucide library not loaded after 5s', CAT.UI);
          resolve();
        }, 5000);
      });
    }

    /**
     * Initialize all Lucide icons on the page
     * @returns {Promise<void>}
     */
    async initializeIcons() {
      await this.readyPromise;

      if (window.lucide) {
        try {
          window.lucide.createIcons();
          logSystem.debug('Icons initialized', CAT.UI);
        } catch (error) {
          logSystem.error('Error initializing icons', CAT.UI, error);
        }
      }
    }

    /**
     * Wrap lucide.createIcons to debounce no-arg calls.
     */
    wrapLucideCreateIcons() {
      if (!window.lucide || this._lucideWrapped) {
        return;
      }

      const original = window.lucide.createIcons;
      if (typeof original !== 'function') {
        return;
      }

      let pending = false;
      const schedule = () => {
        if (pending) return;
        pending = true;
        const run = () => {
          pending = false;
          try {
            original();
          } catch (error) {
            logSystem.error('Error initializing icons (debounced)', CAT.UI, error);
          }
        };

        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(run);
        } else {
          setTimeout(run, 0);
        }
      };

      window.lucide.createIcons = (...args) => {
        // If options are provided, do not debounce.
        if (args && args.length > 0) {
          return original(...args);
        }
        schedule();
        return undefined;
      };
      window.lucide.createIcons.__wrapped = true;
      this._lucideWrapped = true;
      logSystem.debug('Lucide createIcons wrapped (debounced)', CAT.UI);
    }

    /**
     * Create a specific icon element
     * @param {string} iconName - Lucide icon name
     * @param {Object} options - Icon options (size, color, etc.)
     * @returns {Promise<SVGElement|null>}
     */
    async createIcon(iconName, options = {}) {
      await this.readyPromise;

      if (!window.lucide) {
        logSystem.warn('Lucide not available, cannot create icon', CAT.UI);
        return null;
      }

      try {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);

        if (options.size) {
          icon.setAttribute('width', options.size);
          icon.setAttribute('height', options.size);
        }

        if (options.color) {
          const normalized = String(options.color).trim().toLowerCase();
          const colorMap = {
            'var(--error-red)': 'status-error',
            '#ff4444': 'status-error',
            red: 'status-error',
            'var(--warning-orange)': 'status-warning',
            '#ff9900': 'status-warning',
            orange: 'status-warning',
            'var(--success-green)': 'status-success',
            '#00ff88': 'status-success',
            green: 'status-success',
          };
          const className = colorMap[normalized];
          if (className) {
            icon.classList.add(className);
          }
        }

        if (options.className) {
          icon.className = options.className;
        }

        // Replace <i> with actual SVG
        window.lucide.createIcons({
          icons: {
            [iconName]: window.lucide.icons[iconName],
          },
          attrs: {
            'data-lucide': iconName,
          },
        });

        return icon;
      } catch (error) {
        logSystem.error(`Error creating icon ${iconName}`, CAT.UI, error);
        return null;
      }
    }

    /**
     * Ensure cart icon is properly rendered
     * @returns {Promise<void>}
     */
    async ensureCartIcon() {
      await this.readyPromise;

      const checkoutBtn = document.getElementById('checkoutBtn');
      if (!checkoutBtn) return;

      // Check if icon already exists
      const existingIcon = checkoutBtn.querySelector(
        '[data-lucide="shopping-cart"]'
      );
      if (existingIcon && existingIcon.querySelector('svg')) {
        logSystem.trace('Cart icon already rendered', CAT.UI);
        return;
      }

      // Re-initialize icons for this button
      if (window.lucide) {
        window.lucide.createIcons();
        logSystem.debug('Cart icon refreshed', CAT.UI);
      }
    }
  }

  // Create singleton instance
  const iconManagerInstance = new IconManager();

  // Auto-initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      iconManagerInstance.initializeIcons();
    });
  } else {
    iconManagerInstance.initializeIcons();
  }

  // Re-initialize when cart is opened
  document.addEventListener('click', e => {
    if (
      e.target.closest('[data-action="showCart"]') ||
      e.target.closest('.cart-btn')
    ) {
      setTimeout(() => iconManagerInstance.ensureCartIcon(), 100);
    }
  });

  // Expose globally
  window.IconManager = {
    waitForLucide: () => iconManagerInstance.waitForLucide(),
    initializeIcons: () => iconManagerInstance.initializeIcons(),
    createIcon: (name, options) =>
      iconManagerInstance.createIcon(name, options),
    ensureCartIcon: () => iconManagerInstance.ensureCartIcon(),
    _instance: iconManagerInstance,
  };

  logSystem.info('Official module loaded', CAT.INIT);
}

export function initIconManager() {
  if (window.__ICON_MANAGER_INITED__) {
    return;
  }

  window.__ICON_MANAGER_INITED__ = true;
  setupIconManager();
}

if (typeof window !== 'undefined' && !window.__ICON_MANAGER_NO_AUTO__) {
  initIconManager();
}
