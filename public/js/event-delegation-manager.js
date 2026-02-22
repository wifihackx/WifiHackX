/**
 * Event Delegation Manager
 * Robust system for managing event handlers through delegation pattern
 * Ensures handlers work even with dynamically added elements
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupEventDelegationManager() {

  class EventDelegationManager {
    constructor() {
      this.handlers = new Map();
      this.setupGlobalDelegation();
      debugLog('[EventDelegation] EventDelegationManager initialized');
    }

    /**
     * Set up global event delegation at document level
     * Captures all clicks on elements with data-action attribute
     */
    setupGlobalDelegation() {
      // Delegate click events
      document.addEventListener(
        'click',
        e => {
          const target = e.target.closest('[data-action]');
          if (!target) return;

          const action = target.dataset.action;
          const handler = this.handlers.get(action);

          if (!handler) {
            console.warn(
              `[EventDelegation] No handler registered for action: ${action}`
            );
            return;
          }

          try {
            debugLog(
              `[EventDelegation] Executing handler for action: ${action}`
            );
            // CORRECTION: Standardize to (element, event) to match common-handlers expectations
            handler(target, e);
          } catch (error) {
            console.error(
              `[EventDelegation] Handler failed for action "${action}":`,
              error
            );

            // Show user-friendly error if notification system available
            if (window.NotificationSystem) {
              window.NotificationSystem.error('Error al ejecutar la acción');
            }
          }
        },
        true
      ); // Use capture phase

      // Delegate change events for inputs
      document.addEventListener(
        'change',
        e => {
          const target = e.target.closest('[data-action-change]');
          if (!target) return;

          const action = target.dataset.actionChange;
          const handler = this.handlers.get(action);

          if (handler) {
            try {
              debugLog(
                `[EventDelegation] Executing change handler for action: ${action}`
              );
              handler(e, target);
            } catch (error) {
              console.error(
                `[EventDelegation] Change handler failed for action "${action}":`,
                error
              );
            }
          }
        },
        true
      );

      // Delegate input events for real-time updates
      document.addEventListener(
        'input',
        e => {
          const target = e.target.closest('[data-action-input]');
          if (!target) return;

          const action = target.dataset.actionInput;
          const handler = this.handlers.get(action);

          if (handler) {
            try {
              handler(e, target);
            } catch (error) {
              console.error(
                `[EventDelegation] Input handler failed for action "${action}":`,
                error
              );
            }
          }
        },
        true
      );

      debugLog('[EventDelegation] Global delegation set up');
    }

    /**
     * Register an event handler for a specific action
     * @param {string} action - Action name (matches data-action attribute)
     * @param {Function} handler - Handler function (receives event and target element)
     * @param {Object} context - Optional context for handler execution
     */
    register(action, handler, context = null) {
      if (typeof handler !== 'function') {
        console.error(
          `[EventDelegation] Handler for "${action}" must be a function`
        );
        return;
      }

      // If a handler already exists, replace silently to avoid noisy logs

      // Wrap handler with context if provided
      const wrappedHandler = context ? handler.bind(context) : handler;

      this.handlers.set(action, wrappedHandler);
      debugLog(`[EventDelegation] Registered handler for action: ${action}`);
    }

    /**
     * Register multiple handlers at once
     * @param {Object} handlers - Object mapping actions to handler functions
     * @param {Object} context - Optional context for all handlers
     */
    registerMultiple(handlers, context = null) {
      for (const [action, handler] of Object.entries(handlers)) {
        this.register(action, handler, context);
      }
    }

    /**
     * Unregister a handler for a specific action
     * @param {string} action - Action name to unregister
     */
    unregister(action) {
      if (this.handlers.has(action)) {
        this.handlers.delete(action);
        debugLog(
          `[EventDelegation] Unregistered handler for action: ${action}`
        );
      } else {
        console.warn(
          `[EventDelegation] No handler found for action: ${action}`
        );
      }
    }

    /**
     * Trigger an action programmatically
     * @param {string} action - Action name to trigger
     * @param {any} data - Optional data to pass to handler
     */
    trigger(action, data = null) {
      const handler = this.handlers.get(action);

      if (!handler) {
        console.warn(
          `[EventDelegation] Cannot trigger unregistered action: ${action}`
        );
        return;
      }

      try {
        debugLog(
          `[EventDelegation] Triggering action programmatically: ${action}`
        );

        // Create synthetic event-like object
        const syntheticEvent = {
          type: 'synthetic',
          data: data,
          preventDefault: () => {},
          stopPropagation: () => {},
        };

        handler(syntheticEvent, null);
      } catch (error) {
        console.error(
          `[EventDelegation] Failed to trigger action "${action}":`,
          error
        );
      }
    }

    /**
     * Check if a handler is registered for an action
     * @param {string} action - Action name to check
     * @returns {boolean} True if handler is registered
     */
    hasHandler(action) {
      return this.handlers.has(action);
    }

    /**
     * Get list of all registered actions
     * @returns {string[]} Array of action names
     */
    getRegisteredActions() {
      return Array.from(this.handlers.keys());
    }

    /**
     * Get count of registered handlers
     * @returns {number} Number of registered handlers
     */
    getHandlerCount() {
      return this.handlers.size;
    }

    /**
     * Clear all registered handlers
     */
    clearAll() {
      const count = this.handlers.size;
      this.handlers.clear();
      debugLog(`[EventDelegation] Cleared ${count} handlers`);
    }
  }

  // Create global instance
  window.EventDelegationManager = new EventDelegationManager();

  // Maintain backward compatibility with existing EventDelegation
  if (!window.EventDelegation) {
    window.EventDelegation = {
      registerHandler: (action, handler) => {
        window.EventDelegationManager.register(action, handler);
      },
      handlers: window.EventDelegationManager.handlers,
    };
  }

  // Expose for debugging
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    window.eventDelegationDebug = {
      getActions: () => window.EventDelegationManager.getRegisteredActions(),
      getCount: () => window.EventDelegationManager.getHandlerCount(),
      hasHandler: action => window.EventDelegationManager.hasHandler(action),
      trigger: (action, data) =>
        window.EventDelegationManager.trigger(action, data),
    };
  }

  debugLog('[EventDelegation] EventDelegationManager ready');
}

export function initEventDelegationManager() {
  if (window.__EVENT_DELEGATION_MANAGER_INITED__) {
    return;
  }

  window.__EVENT_DELEGATION_MANAGER_INITED__ = true;
  setupEventDelegationManager();
}

if (typeof window !== 'undefined' && !window.__EVENT_DELEGATION_MANAGER_NO_AUTO__) {
  initEventDelegationManager();
}



