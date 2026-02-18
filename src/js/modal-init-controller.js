/**
 * modal-init-controller.js
 * Modal initialization controller with AppState integration
 * @version 2.0.0 - AppState Integration
 */

// Validate AppState is available
if (!window.AppState) {
  const error = new Error(
    '[modal-init-controller.js] Failed to load: window.AppState is not defined. ' +
      'Ensure app-state.js loads before modal-init-controller.js.'
  );
  console.error(error);
  throw error;
}

// Record load time for validation (dev only)
if (window.LoadOrderValidator) {
  window.LoadOrderValidator.recordScriptLoad('modal-init-controller.js');
}

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupModalInitController() {

  // Use AppState from window
  const AppState = window.AppState;

  // Guard pattern: Prevent duplicate loading
  if (window.isScriptLoaded && window.isScriptLoaded('modal-init-controller')) {
    debugLog('modal-init-controller already loaded, skipping');
    return;
  }

  debugLog('🔧 MODAL INIT CONTROLLER LOADING...');

  /**
   * ModalController class
   * Manages modal state using AppState
   */
  class ModalController {
    constructor() {
      this.initialized = false;
      this.setupObservers();
    }

    /**
     * Initialize modal controller
     */
    init() {
      if (this.initialized) {
        debugLog('[ModalController] Already initialized');
        return;
      }

      debugLog('[ModalController] Initializing with AppState...');

      // Initialize modal state if needed
      const currentModal = AppState.getState('modal.active');
      if (currentModal === undefined) {
        AppState.setState('modal.active', null, true);
        AppState.setState('modal.history', [], true);
        AppState.setState('modal.data', null, true);
      } else {
        // Si hay un modal activo persistido, validar si puede mostrarse
        if (!this.isModalAllowed(currentModal)) {
          AppState.setState('modal.active', null, true);
        }
      }

      this.initialized = true;
      debugLog('[ModalController] Initialized successfully');
    }

    /**
     * Set up observers for modal state changes
     */
    setupObservers() {
      // Observer for modal.active changes - update modal display
      AppState.subscribe('modal.active', (newModalId, oldModalId) => {
        this.handleModalChange(newModalId, oldModalId);
      });

      // Observer for modal.data changes - update modal content
      AppState.subscribe('modal.data', newData => {
        this.handleModalDataChange(newData);
      });

      debugLog('[ModalController] Observers configured');
    }

    /**
     * Handle modal state changes
     * @param {string|null} newModalId - New active modal ID
     * @param {string|null} oldModalId - Previous active modal ID
     */
    handleModalChange(newModalId, oldModalId) {
      if (newModalId === oldModalId) {
        return;
      }

      debugLog(
        `[ModalController] Modal changed: ${oldModalId || 'none'} → ${newModalId || 'none'}`
      );

      // Hide old modal if exists
      if (oldModalId) {
        this.hideModalElement(oldModalId);
      }

      // Show new modal if exists
      if (newModalId) {
        this.showModalElement(newModalId);
      }
    }

    /**
     * Handle modal data changes
     * @param {Object|null} newData - New modal data
     */
    handleModalDataChange(newData) {
      const activeModal = AppState.getState('modal.active');

      if (!activeModal) {
        return;
      }

      debugLog(`[ModalController] Modal data updated for: ${activeModal}`);

      // Update modal content with new data
      this.updateModalContent(activeModal, newData);
    }

    /**
     * Show a modal element
     * @param {string} modalId - Modal ID to show
     */
    showModalElement(modalId) {
      if (!this.isModalAllowed(modalId)) {
        AppState.setState('modal.active', null);
        return;
      }
      if (window.ModalManager) {
        window.ModalManager.open(modalId);
      } else {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;
        modalElement.classList.add('active', 'show');
        window.DOMUtils.setDisplay(modalElement, 'block');
        modalElement.setAttribute('aria-hidden', 'false');
        modalElement.setAttribute('aria-modal', 'true');
        document.body.classList.add('modal-open');
      }
      debugLog(`[ModalController] Showed modal: ${modalId} (delegated)`);
    }

    /**
     * Verificar si un modal puede mostrarse en el contexto actual
     * @param {string} modalId
     * @returns {boolean}
     */
    isModalAllowed(modalId) {
      if (!modalId) return true;

      const currentView = document.body.getAttribute('data-current-view');
      const adminView = document.getElementById('adminView');
      const isAdminViewActive =
        currentView === 'adminView' ||
        (adminView && adminView.classList.contains('active'));

      const isAuthenticated = (() => {
        try {
          if (window.AppState && typeof window.AppState.getState === 'function') {
            return !!window.AppState.getState('user.isAuthenticated');
          }
          if (window.firebase && firebase.auth && firebase.auth().currentUser) {
            return true;
          }
        } catch (_e) {}
        return false;
      })();

      const adminOnlyModals = new Set([
        'userFormModal',
          'deleteUserModal',
          'banReasonModal',
        ]);

      // Modales solo de admin: no mostrar fuera de adminView
      if (adminOnlyModals.has(modalId) && !isAdminViewActive) {
        console.warn(
          `[ModalController] Bloqueando ${modalId} fuera de adminView`
        );
        return false;
      }

      // Modal de usuario baneado solo con usuario autenticado
      if (modalId === 'bannedUserModal' && !isAuthenticated) {
        console.warn(
          '[ModalController] Bloqueando bannedUserModal sin autenticación'
        );
        return false;
      }

      return true;
    }

    /**
     * Hide a modal element
     * @param {string} modalId - Modal ID to hide
     */
    hideModalElement(modalId) {
      if (window.ModalManager) {
        window.ModalManager.close(modalId);
      } else {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;
        modalElement.classList.remove('active', 'show');
        window.DOMUtils.setDisplay(modalElement, 'none');
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
      }
      debugLog(`[ModalController] Hid modal: ${modalId} (delegated)`);
    }

    /**
     * Update modal content with data
     * @param {string} modalId - Modal ID
     * @param {Object|null} data - Modal data
     */
    updateModalContent(modalId, data) {
      const modalElement = document.getElementById(modalId);

      if (!modalElement || !data) {
        return;
      }

      // Dispatch custom event with modal data
      const event = new CustomEvent('modalDataUpdate', {
        detail: {
          modalId,
          data,
        },
        bubbles: true,
      });
      modalElement.dispatchEvent(event);

      debugLog(`[ModalController] Updated content for modal: ${modalId}`);
    }

    /**
     * Open a modal
     * @param {string} modalId - Modal ID to open
     * @param {Object} [data] - Optional modal data
     */
    openModal(modalId, data = null) {
      if (!modalId) {
        console.warn('[ModalController] Cannot open modal without ID');
        return;
      }

      // Store previous modal in history
      const currentModal = AppState.getState('modal.active');
      if (currentModal && currentModal !== modalId) {
        const history = AppState.getState('modal.history') || [];
        AppState.setState('modal.history', [...history, currentModal]);
      }

      // Set active modal
      AppState.setState('modal.active', modalId);

      // Set modal data if provided
      if (data) {
        AppState.setState('modal.data', data);
      }

      debugLog(`[ModalController] Opened modal: ${modalId}`);
    }

    /**
     * Close the active modal
     */
    closeModal() {
      const currentModal = AppState.getState('modal.active');

      if (!currentModal) {
        console.warn('[ModalController] No active modal to close');
        return;
      }

      // Clear modal state
      AppState.setState('modal.active', null);
      AppState.setState('modal.data', null);

      debugLog(`[ModalController] Closed modal: ${currentModal}`);
    }

    /**
     * Go back to previous modal in history
     */
    goBackModal() {
      const history = AppState.getState('modal.history') || [];

      if (history.length === 0) {
        console.warn('[ModalController] No modal history to go back to');
        this.closeModal();
        return;
      }

      // Get previous modal
      const previousModal = history[history.length - 1];

      // Remove from history
      AppState.setState('modal.history', history.slice(0, -1));

      // Set as active
      AppState.setState('modal.active', previousModal);

      debugLog(`[ModalController] Went back to modal: ${previousModal}`);
    }

    /**
     * Get active modal ID
     * @returns {string|null} Active modal ID
     */
    getActiveModal() {
      return AppState.getState('modal.active');
    }

    /**
     * Get modal data
     * @returns {Object|null} Modal data
     */
    getModalData() {
      return AppState.getState('modal.data');
    }

    /**
     * Check if a modal is active
     * @param {string} modalId - Modal ID to check
     * @returns {boolean} True if modal is active
     */
    isModalActive(modalId) {
      return AppState.getState('modal.active') === modalId;
    }
  }

  // Create global instance
  const modalController = new ModalController();

  // Initialize
  modalController.init();

  // Expose to window for backward compatibility
  window.ModalController = modalController;

  // Expose individual methods for convenience
  window.openModal = (modalId, data) =>
    modalController.openModal(modalId, data);
  window.closeModal = () => modalController.closeModal();
  window.goBackModal = () => modalController.goBackModal();

  debugLog('✅ Modal Init Controller loaded with AppState integration');

  // Mark script as loaded
  if (window.markScriptLoaded) {
    window.markScriptLoaded('modal-init-controller');
  }
}

export function initModalInitController() {
  if (window.__MODAL_INIT_CONTROLLER_INITED__) {
    return;
  }

  window.__MODAL_INIT_CONTROLLER_INITED__ = true;
  setupModalInitController();
}

if (typeof window !== 'undefined' && !window.__MODAL_INIT_CONTROLLER_NO_AUTO__) {
  initModalInitController();
}

