/**
 * @fileoverview Migration Adapters for Backward Compatibility
 * @module core/migration-adapters
 * @description
 * Provides backward compatibility wrappers that allow legacy code to work
 * with the new AppState system. Each adapter translates legacy API calls
 * to AppState operations while maintaining identical behavior.
 *
 * @author WifiHackX Development Team
 * @version 1.0.0
 * @since 2026-01-22
 *
 * @example
 * // Legacy code continues to work:
 * window.currentView = 'homeView'; // Now uses AppState internally
 * const user = auth.getCurrentUser(); // Now reads from AppState
 */

(function () {
  'use strict';

  // Validate that AppState is available
  if (typeof window === 'undefined' || !window.AppState) {
    const error = new Error(
      '[MigrationAdapters] Failed to load: window.AppState is not defined. ' +
        'Ensure app-state.js loads before migration-adapters.js.'
    );
    console.error(error);
    throw error;
  }

  // Record load time for validation (dev only)
  if (window.LoadOrderValidator) {
    window.LoadOrderValidator.recordScriptLoad('migration-adapters.js');
  }

  // Get AppState from window
  const { getState, setState, subscribe } = window.AppState;

  /**
   * Flag to control deprecation warnings
   * @private
   */
  let showDeprecationWarnings = false; // Deshabilitado por defecto para reducir ruido

  /**
   * Log a deprecation warning (throttled)
   * @private
   * @param {string} oldAPI - The deprecated API being used
   * @param {string} newAPI - The recommended new API
   */
  const deprecationWarnings = new Set();

  function logDeprecation(oldAPI, newAPI) {
    if (showDeprecationWarnings && !deprecationWarnings.has(oldAPI)) {
      console.warn(
        `[MigrationAdapter] DEPRECATED: ${oldAPI} is deprecated. Use ${newAPI} instead.`
      );
      deprecationWarnings.add(oldAPI); // Solo mostrar una vez por API
    }
  }

  /**
   * Enable or disable deprecation warnings
   * @param {boolean} enabled - Whether to show deprecation warnings
   */
  function setDeprecationWarnings(enabled) {
    showDeprecationWarnings = enabled;
  }

  // ============================================================================
  // AUTH MODULE ADAPTER
  // ============================================================================

  /**
   * Auth module adapter
   * Provides backward compatibility for auth-related APIs
   */
  const authAdapter = {
    /**
     * Get current user from AppState
     * Legacy API: auth.getCurrentUser()
     * @returns {Object|null} Current user or null
     */
    getCurrentUser() {
      logDeprecation('auth.getCurrentUser()', 'getState("user")');
      return getState('user');
    },

    /**
     * Set user in AppState
     * Legacy API: auth.setUser(user)
     * @param {Object|null} user - User object or null
     */
    setUser(user) {
      logDeprecation('auth.setUser()', 'setState("user", user)');

      if (user) {
        // Update user state with all properties
        setState('user', {
          uid: user.uid || null,
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          isAuthenticated: true,
          isAdmin: user.isAdmin || false,
          role: user.role || 'client',
        });
      } else {
        // Clear user state on logout
        setState('user', {
          uid: null,
          email: null,
          displayName: null,
          photoURL: null,
          isAuthenticated: false,
          isAdmin: false,
          role: 'client',
        });
      }
    },

    /**
     * Check if user is authenticated
     * Legacy API: auth.isAuthenticated()
     * @returns {boolean} True if user is authenticated
     */
    isAuthenticated() {
      logDeprecation(
        'auth.isAuthenticated()',
        'getState("user.isAuthenticated")'
      );
      return getState('user.isAuthenticated') || false;
    },

    /**
     * Check if user is admin
     * Legacy API: auth.isAdmin()
     * @returns {boolean} True if user is admin
     */
    isAdmin() {
      logDeprecation('auth.isAdmin()', 'getState("user.isAdmin")');
      return getState('user.isAdmin') || false;
    },
  };

  // Expose auth adapter to window
  if (typeof window !== 'undefined') {
    window.auth = window.auth || {};
    Object.assign(window.auth, authAdapter);
  }

  // ============================================================================
  // CART MODULE ADAPTER
  // ============================================================================

  /**
   * Cart module adapter
   * Provides backward compatibility for cart-related APIs
   */

  // Define window.cart as a getter/setter that syncs with AppState
  if (typeof window !== 'undefined') {
    // Store reference to any existing cart
    const existingCart = window.cart;

    // Define cart property with getter/setter
    Object.defineProperty(window, 'cart', {
      get() {
        logDeprecation('window.cart', 'getState("cart.items")');
        return getState('cart.items') || [];
      },
      set(items) {
        logDeprecation('window.cart = items', 'setState("cart.items", items)');
        setState('cart.items', Array.isArray(items) ? items : []);

        // Update cart count
        const count = Array.isArray(items) ? items.length : 0;
        setState('cart.count', count);

        // Calculate total
        const total = Array.isArray(items)
          ? items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)
          : 0;
        setState('cart.total', total);
      },
      configurable: true,
      enumerable: true,
    });

    // Initialize cart from existing value if present
    if (existingCart && Array.isArray(existingCart)) {
      setState('cart.items', existingCart, true); // Silent update
    }
  }

  /**
   * CartManager adapter
   * Wraps CartManager methods to sync with AppState
   */
  const cartManagerAdapter = {
    /**
     * Add item to cart
     * Legacy API: CartManager.addToCart(product)
     * @param {Object} product - Product to add
     */
    addToCart(product) {
      logDeprecation(
        'CartManager.addToCart()',
        'setState("cart.items", [...items, product])'
      );

      if (!product || !product.id || product.id.trim() === '') {
        console.warn('[MigrationAdapter] Cannot add item without valid id');
        return;
      }

      const items = getState('cart.items') || [];

      // Check for duplicates
      if (items.find(item => item.id === product.id)) {
        console.warn('[MigrationAdapter] Item already in cart:', product.id);
        return;
      }

      // Add item with timestamp
      const newItems = [
        ...items,
        {
          ...product,
          addedAt: new Date().toISOString(),
        },
      ];
      setState('cart.items', newItems);
      setState('cart.count', newItems.length);

      // Update total
      const total = newItems.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0),
        0
      );
      setState('cart.total', total);
    },

    /**
     * Remove item from cart
     * Legacy API: CartManager.removeItem(id)
     * @param {string} id - Item ID to remove
     */
    removeItem(id) {
      logDeprecation(
        'CartManager.removeItem()',
        'setState("cart.items", items.filter(...))'
      );

      const items = getState('cart.items') || [];
      const newItems = items.filter(item => String(item.id) !== String(id));

      setState('cart.items', newItems);
      setState('cart.count', newItems.length);

      // Update total
      const total = newItems.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0),
        0
      );
      setState('cart.total', total);
    },

    /**
     * Clear cart
     * Legacy API: CartManager.clear()
     */
    clear() {
      logDeprecation('CartManager.clear()', 'setState("cart.items", [])');

      setState('cart.items', []);
      setState('cart.count', 0);
      setState('cart.total', 0);
    },

    /**
     * Get cart items
     * Legacy API: CartManager.getItems()
     * @returns {Array} Cart items
     */
    getItems() {
      logDeprecation('CartManager.getItems()', 'getState("cart.items")');
      return getState('cart.items') || [];
    },
  };

  // Expose CartManager adapter to window
  if (typeof window !== 'undefined') {
    // Preserve existing CartManager if it exists
    const existingCartManager = window.CartManager;

    if (existingCartManager && typeof existingCartManager === 'object') {
      // Wrap existing methods
      const originalAddToCart = existingCartManager.addToCart;
      if (originalAddToCart) {
        existingCartManager.addToCart = function (product) {
          // Call original method
          const result = originalAddToCart.call(this, product);

          // Sync with AppState
          if (this.items) {
            setState('cart.items', this.items, true); // Silent to avoid loops
            setState('cart.count', this.items.length, true);
            const total = this.items.reduce(
              (sum, item) => sum + (parseFloat(item.price) || 0),
              0
            );
            setState('cart.total', total, true);
          }

          return result;
        };
      }

      // Subscribe to AppState changes to update CartManager
      subscribe('cart.items', newItems => {
        if (existingCartManager.items) {
          existingCartManager.items = newItems || [];
        }
      });
    } else {
      // Create new CartManager adapter
      window.CartManager = cartManagerAdapter;
    }
  }

  // ============================================================================
  // VIEW MODULE ADAPTER
  // ============================================================================

  /**
   * View module adapter
   * Provides backward compatibility for view/navigation APIs
   */

  if (typeof window !== 'undefined') {
    // Store reference to any existing currentView
    const existingView = window.currentView;

    // Define currentView property with getter/setter
    Object.defineProperty(window, 'currentView', {
      get() {
        logDeprecation('window.currentView', 'getState("view.current")');
        return getState('view.current') || 'homeView';
      },
      set(viewId) {
        logDeprecation(
          'window.currentView = viewId',
          'setState("view.current", viewId)'
        );

        // Store previous view
        const previousView = getState('view.current');
        if (previousView && previousView !== viewId) {
          setState('view.previous', previousView);

          // Update history
          const history = getState('view.history') || [];
          setState('view.history', [...history, previousView]);
        }

        // Set new view
        setState('view.current', viewId);
      },
      configurable: true,
      enumerable: true,
    });

    // Initialize view from existing value if present
    if (existingView) {
      setState('view.current', existingView, true); // Silent update
    }
  }

  // ============================================================================
  // MODAL MODULE ADAPTER
  // ============================================================================

  /**
   * Modal module adapter
   * Provides backward compatibility for modal-related APIs
   */
  const modalAdapter = {
    /**
     * Show modal
     * Legacy API: modal.show(modalId, data)
     * @param {string} modalId - Modal ID to show
     * @param {Object} [data] - Optional modal data
     */
    show(modalId, data = null) {
      logDeprecation('modal.show()', 'setState("modal.active", modalId)');

      // Store previous modal in history
      const currentModal = getState('modal.active');
      if (currentModal) {
        const history = getState('modal.history') || [];
        setState('modal.history', [...history, currentModal]);
      }

      setState('modal.active', modalId);
      if (data) {
        setState('modal.data', data);
      }
    },

    /**
     * Hide modal
     * Legacy API: modal.hide()
     */
    hide() {
      logDeprecation('modal.hide()', 'setState("modal.active", null)');

      setState('modal.active', null);
      setState('modal.data', null);
    },

    /**
     * Get active modal
     * Legacy API: modal.getActive()
     * @returns {string|null} Active modal ID
     */
    getActive() {
      logDeprecation('modal.getActive()', 'getState("modal.active")');
      return getState('modal.active');
    },

    /**
     * Get modal data
     * Legacy API: modal.getData()
     * @returns {Object|null} Modal data
     */
    getData() {
      logDeprecation('modal.getData()', 'getState("modal.data")');
      return getState('modal.data');
    },
  };

  // Expose modal adapter to window
  if (typeof window !== 'undefined') {
    window.modal = window.modal || {};
    Object.assign(window.modal, modalAdapter);
  }

  // ============================================================================
  // NOTIFICATION MODULE ADAPTER
  // ============================================================================

  /**
   * Notification ID counter for unique IDs
   * @private
   */
  let notificationIdCounter = 0;

  /**
   * Notification module adapter
   * Provides backward compatibility for notification APIs
   */
  const notificationAdapter = {
    /**
     * Add notification
     * Legacy API: notifications.add(notification)
     * @param {Object} notification - Notification object
     */
    add(notification) {
      logDeprecation(
        'notifications.add()',
        'setState("notifications.queue", [...queue, notification])'
      );

      const queue = getState('notifications.queue') || [];
      const newQueue = [
        ...queue,
        {
          ...notification,
          id: `notif_${++notificationIdCounter}_${Date.now()}`,
          timestamp: new Date(),
        },
      ];

      setState('notifications.queue', newQueue);
      setState('notifications.unreadCount', newQueue.length);
    },

    /**
     * Remove notification
     * Legacy API: notifications.remove(id)
     * @param {string|number} id - Notification ID
     */
    remove(id) {
      logDeprecation(
        'notifications.remove()',
        'setState("notifications.queue", queue.filter(...))'
      );

      const queue = getState('notifications.queue') || [];
      const newQueue = queue.filter(n => n.id !== id);

      setState('notifications.queue', newQueue);
      setState('notifications.unreadCount', newQueue.length);
    },

    /**
     * Clear all notifications
     * Legacy API: notifications.clear()
     */
    clear() {
      logDeprecation(
        'notifications.clear()',
        'setState("notifications.queue", [])'
      );

      setState('notifications.queue', []);
      setState('notifications.unreadCount', 0);
    },

    /**
     * Get notification queue
     * Legacy API: notifications.getQueue()
     * @returns {Array} Notification queue
     */
    getQueue() {
      logDeprecation(
        'notifications.getQueue()',
        'getState("notifications.queue")'
      );
      return getState('notifications.queue') || [];
    },
  };

  // Expose notification adapter to window
  if (typeof window !== 'undefined') {
    window.notifications = window.notifications || {};
    Object.assign(window.notifications, notificationAdapter);
  }

  // ============================================================================
  // I18N MODULE ADAPTER
  // ============================================================================

  /**
   * I18n module adapter
   * Provides backward compatibility for internationalization APIs
   */
  const i18nAdapter = {
    /**
     * Set current language
     * Legacy API: i18n.setLanguage(lang)
     * @param {string} lang - Language code
     */
    setLanguage(lang) {
      logDeprecation(
        'i18n.setLanguage()',
        'setState("i18n.currentLanguage", lang)'
      );

      const availableLanguages = getState('i18n.availableLanguages') || [
        'es',
        'en',
        'fr',
        'de',
      ];

      if (!availableLanguages.includes(lang)) {
        console.warn(`[MigrationAdapter] Language "${lang}" not available`);
        return;
      }

      setState('i18n.currentLanguage', lang);
    },

    /**
     * Get current language
     * Legacy API: i18n.getLanguage()
     * @returns {string} Current language code
     */
    getLanguage() {
      logDeprecation('i18n.getLanguage()', 'getState("i18n.currentLanguage")');
      return getState('i18n.currentLanguage') || 'es';
    },

    /**
     * Get available languages
     * Legacy API: i18n.getAvailableLanguages()
     * @returns {Array} Available language codes
     */
    getAvailableLanguages() {
      logDeprecation(
        'i18n.getAvailableLanguages()',
        'getState("i18n.availableLanguages")'
      );
      return getState('i18n.availableLanguages') || ['es', 'en', 'fr', 'de'];
    },
  };

  // Expose i18n adapter to window
  if (typeof window !== 'undefined') {
    window.i18n = window.i18n || {};
    Object.assign(window.i18n, i18nAdapter);
  }

  // ============================================================================
  // ADMIN MODULE ADAPTER
  // ============================================================================

  /**
   * Admin module adapter
   * Provides backward compatibility for admin panel APIs
   */
  const adminAdapter = {
    /**
     * Set admin data
     * Legacy API: admin.setData(data)
     * @param {Object} data - Admin data
     */
    setData(data) {
      logDeprecation('admin.setData()', 'setState("admin.data", data)');
      setState('admin.data', data);
    },

    /**
     * Get admin data
     * Legacy API: admin.getData()
     * @returns {Object|null} Admin data
     */
    getData() {
      logDeprecation('admin.getData()', 'getState("admin.data")');
      return getState('admin.data');
    },

    /**
     * Set admin filters
     * Legacy API: admin.setFilters(filters)
     * @param {Object} filters - Filter object
     */
    setFilters(filters) {
      logDeprecation(
        'admin.setFilters()',
        'setState("admin.filters", filters)'
      );
      setState('admin.filters', filters);
    },

    /**
     * Get admin filters
     * Legacy API: admin.getFilters()
     * @returns {Object} Admin filters
     */
    getFilters() {
      logDeprecation('admin.getFilters()', 'getState("admin.filters")');
      return getState('admin.filters') || {};
    },

    /**
     * Set selected users
     * Legacy API: admin.setSelectedUsers(users)
     * @param {Array} users - Selected user IDs
     */
    setSelectedUsers(users) {
      logDeprecation(
        'admin.setSelectedUsers()',
        'setState("admin.selectedUsers", users)'
      );
      setState('admin.selectedUsers', Array.isArray(users) ? users : []);
    },

    /**
     * Get selected users
     * Legacy API: admin.getSelectedUsers()
     * @returns {Array} Selected user IDs
     */
    getSelectedUsers() {
      logDeprecation(
        'admin.getSelectedUsers()',
        'getState("admin.selectedUsers")'
      );
      return getState('admin.selectedUsers') || [];
    },
  };

  // Expose admin adapter to window
  if (typeof window !== 'undefined') {
    window.admin = window.admin || {};
    Object.assign(window.admin, adminAdapter);

    // ============================================================================
    // COMPONENTS MIGRATION (window.Components is reserved/deprecated)
    // ============================================================================
    // Note: window.Components is no longer defined here to avoid conflicts
    // with browser-reserved names (e.g., Firefox).
    // Use window.WifiHackX.Components instead.
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  console.log('[MigrationAdapter] Backward compatibility adapters initialized');
  console.log('[MigrationAdapter] Legacy APIs now use AppState internally');

  // Expose adapters and utilities to window
  if (typeof window !== 'undefined') {
    window.MigrationAdapters = {
      setDeprecationWarnings,
      authAdapter,
      cartManagerAdapter,
      modalAdapter,
      notificationAdapter,
      i18nAdapter,
      adminAdapter,
    };
  }
})(); // End of IIFE
