/**
 * notification-system.js
 * Sistema de notificaciones mejorado con AppState integration
 * Compatible con CSP (Content Security Policy)
 * @version 3.0.0 - Full AppState Integration
 */

/* global */

// Validate AppState is available
if (!window.AppState) {
  const error = new Error(
    '[notification-system.js] Failed to load: window.AppState is not defined. ' +
      'Ensure app-state.js loads before notification-system.js.'
  );
  console.error(error);
  throw error;
}

// Record load time for validation (dev only)
if (window.LoadOrderValidator) {
  window.LoadOrderValidator.recordScriptLoad('notification-system.js');
}

'use strict';

function setupNotificationSystem() {

  // Usar AppState global internamente
  const AppState = window.AppState;

  // Notification ID counter
  let notificationIdCounter = 0;

  // Configuración por defecto
  const DEFAULTS = {
    position: 'top-right',
    duration: 2000, // Reducido de 5000ms a 2000ms (2 segundos)
    closeButton: true,
    maxNotifications: 5,
    offsetFromHeader: true,
    headerMargin: 20, // Aumentado para más espacio debajo del header
  };
  // Estilos movidos a css/notification-system.css (CSP)

  const getDurationClass = ms => {
    if (!ms || ms <= 0) return '';
    if (ms <= 1000) return 'duration-1000';
    if (ms <= 1500) return 'duration-1500';
    if (ms <= 2000) return 'duration-2000';
    if (ms <= 3000) return 'duration-3000';
    if (ms <= 4000) return 'duration-4000';
    return 'duration-5000';
  };

  // Crear contenedor
  function createContainer(position) {
    const container = document.createElement('div');
    container.className = `notification-container ${position}`;
    container.id = `notification-container-${position}`;
    document.body.appendChild(container);
    return container;
  }
  // Obtener o crear contenedor
  function getContainer(position) {
    const id = `notification-container-${position}`;
    return document.getElementById(id) || createContainer(position);
  }
  // Limitar notificaciones
  function limitNotifications(container, max) {
    const notifications = container.querySelectorAll(
      '.notification:not(.hide)'
    );
    if (notifications.length > max) {
      for (let i = 0; i < notifications.length - max; i++) {
        notifications[i].remove();
      }
    }
  }
  // Cerrar notificación
  function closeNotification(notification) {
    if (!notification) return;
    notification.classList.add('hide');
    notification.addEventListener(
      'transitionend',
      () => notification.remove(),
      {
        once: true,
      }
    );
  }
  // Mostrar notificación
  function showNotification(options) {
    // Soporte para llamada simple: showNotification(message, type, duration)
    if (typeof options === 'string') {
      options = {
        message: options,
        type: arguments[1] || 'info',
        duration: arguments[2] || DEFAULTS.duration,
      };
    }
    const {
      type = 'info',
      message = '',
      duration = DEFAULTS.duration,
      position = DEFAULTS.position,
      closeButton = DEFAULTS.closeButton,
      maxNotifications = DEFAULTS.maxNotifications,
    } = options;

    // Dedupe admin protection banner (can be triggered by multiple observers)
    if (message === '🛡️ Protección de administrador activa') {
      if (window.__ADMIN_PROTECTION_NOTIFICATION_SHOWN__) {
        return;
      }
      window.__ADMIN_PROTECTION_NOTIFICATION_SHOWN__ = true;
    }

    // Add notification to AppState queue
    const notificationId = `notif_${++notificationIdCounter}_${Date.now()}`;
    const notificationData = {
      id: notificationId,
      type,
      message,
      duration,
      position,
      closeButton,
      timestamp: new Date().toISOString(),
    };

    addNotificationToQueue(notificationData);

    const container = getContainer(position);
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.notificationId = notificationId;
    // Icono según tipo
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    // Crear elementos
    const iconSpan = document.createElement('span');
    iconSpan.className = 'notification-icon';
    iconSpan.textContent = icons[type] || icons.info;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notification-content';
    contentDiv.textContent = message;
    notification.appendChild(iconSpan);
    notification.appendChild(contentDiv);
    // Barra de progreso
    const progress = document.createElement('div');
    progress.className = 'notification-progress';
    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress-bar';
    progress.appendChild(progressBar);
    notification.appendChild(progress);
    if (closeButton) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'notification-close';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Cerrar notificación');
      closeBtn.addEventListener('click', () => {
        closeNotification(notification);
        // Remove from AppState queue
        removeNotificationFromQueue(notificationId);
      });
      notification.appendChild(closeBtn);
    }
    // Auto-ocultar
    let timeoutId;
    if (duration > 0) {
      const durationClass = getDurationClass(duration);
      if (durationClass) {
        progressBar.classList.add(durationClass);
      }
      timeoutId = setTimeout(() => {
        closeNotification(notification);
        // Remove from AppState queue
        removeNotificationFromQueue(notificationId);
      }, duration);
    }
    // Pausar al hover
    notification.addEventListener('mouseenter', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
    notification.addEventListener('mouseleave', () => {
      if (duration > 0) {
        timeoutId = setTimeout(() => {
          closeNotification(notification);
          // Remove from AppState queue
          removeNotificationFromQueue(notificationId);
        }, duration);
      }
    });
    container.appendChild(notification);
    limitNotifications(container, maxNotifications);
    return {
      close: () => {
        closeNotification(notification);
        removeNotificationFromQueue(notificationId);
      },
    };
  }

  /**
   * Initialize AppState for notifications
   * Sets up initial state if not already present
   */
  function initializeNotificationState() {
    const currentQueue = AppState.getState('notifications.queue');
    if (currentQueue === undefined) {
      AppState.setState('notifications.queue', [], true);
      AppState.setState('notifications.unreadCount', 0, true);
    }

    console.log('[NotificationSystem] Initialized with AppState');
  }

  /**
   * Set up observers for notification state changes
   * Observers react to queue changes and update UI accordingly
   */
  function setupObservers() {
    // Observer for notifications.queue changes - display notifications
    AppState.subscribe('notifications.queue', (newQueue, oldQueue) => {
      const oldLength = (oldQueue && oldQueue.length) || 0;
      const newLength = (newQueue && newQueue.length) || 0;

      console.log(
        `[NotificationSystem] Queue updated: ${oldLength} → ${newLength}`
      );

      // If queue increased, a new notification was added
      if (newLength > oldLength) {
        const newNotifications = newQueue.slice(oldLength);
        newNotifications.forEach(notif => {
          console.log(
            `[NotificationSystem] New notification in queue: ${notif.type} - ${notif.message}`
          );
        });
      }

      // If queue decreased, notifications were removed
      if (newLength < oldLength) {
        console.log(
          `[NotificationSystem] ${oldLength - newLength} notification(s) removed from queue`
        );
      }
    });

    // Observer for unreadCount changes
    AppState.subscribe('notifications.unreadCount', (newCount, oldCount) => {
      console.log(
        `[NotificationSystem] Unread count: ${oldCount || 0} → ${newCount || 0}`
      );

      // Update UI badge or counter if exists
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        badge.textContent = newCount > 0 ? newCount : '';
        badge.classList.toggle('hidden', newCount <= 0);
      }
    });

    console.log('[NotificationSystem] Observers configured');
  }

  /**
   * Add notification to AppState queue
   * @param {Object} notificationData - Notification data object
   */
  function addNotificationToQueue(notificationData) {
    const queue = AppState.getState('notifications.queue') || [];
    AppState.setState('notifications.queue', [...queue, notificationData]);
    AppState.setState('notifications.unreadCount', queue.length + 1);
  }

  /**
   * Remove notification from AppState queue by ID
   * @param {string} notificationId - Notification ID to remove
   */
  function removeNotificationFromQueue(notificationId) {
    const queue = AppState.getState('notifications.queue') || [];
    const newQueue = queue.filter(n => n.id !== notificationId);
    AppState.setState('notifications.queue', newQueue);
    AppState.setState('notifications.unreadCount', newQueue.length);
  }

  /**
   * Clear all notifications from queue
   */
  function clearAllNotifications() {
    AppState.setState('notifications.queue', []);
    AppState.setState('notifications.unreadCount', 0);

    // Clear all visible notifications from DOM
    document
      .querySelectorAll('.notification')
      .forEach(n => closeNotification(n));

    console.log('[NotificationSystem] All notifications cleared');
  }

  /**
   * Get notification queue from AppState
   * @returns {Array} Array of notification objects
   */
  function getNotificationQueue() {
    return AppState.getState('notifications.queue') || [];
  }

  /**
   * Get unread notification count from AppState
   * @returns {number} Number of unread notifications
   */
  function getUnreadCount() {
    return AppState.getState('notifications.unreadCount') || 0;
  }

  // Initialize on load
  initializeNotificationState();
  setupObservers();
  // API pública
  window.NotificationSystem = {
    // Core notification methods
    show: showNotification,
    success: (message, options) =>
      showNotification({
        ...options,
        type: 'success',
        message,
      }),
    error: (message, options) =>
      showNotification({
        ...options,
        type: 'error',
        message,
      }),
    warning: (message, options) =>
      showNotification({
        ...options,
        type: 'warning',
        message,
      }),
    info: (message, options) =>
      showNotification({
        ...options,
        type: 'info',
        message,
      }),

    // Queue management methods (AppState-powered)
    getQueue: getNotificationQueue,
    clearQueue: clearAllNotifications,
    getUnreadCount: getUnreadCount,
    removeNotification: removeNotificationFromQueue,

    // Direct AppState access for advanced usage
    subscribe: callback => AppState.subscribe('notifications.queue', callback),
  };
  // También exponer showNotification directamente para safeNotify
  window._showNotification = showNotification;

  // Log de inicialización
  console.log('✅ Sistema de notificaciones inicializado con AppState v3.0');
  console.log(
    '[NotificationSystem] API methods:',
    Object.keys(window.NotificationSystem)
  );
  console.log(
    '[NotificationSystem] Current queue size:',
    getNotificationQueue().length
  );
  console.log('[NotificationSystem] Unread count:', getUnreadCount());
}

export function initNotificationSystem() {
  if (window.__NOTIFICATION_SYSTEM_INITED__) {
    return;
  }

  window.__NOTIFICATION_SYSTEM_INITED__ = true;
  setupNotificationSystem();
}

if (typeof window !== 'undefined' && !window.__NOTIFICATION_SYSTEM_NO_AUTO__) {
  initNotificationSystem();
}
