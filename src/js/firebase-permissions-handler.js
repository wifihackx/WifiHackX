/**
 * Firebase Permissions Handler
 * Maneja errores de permisos y proporciona feedback útil al usuario
 */

class FirebasePermissionsHandler {
  constructor() {
    this.permissionErrors = [];
    this.init();
  }

  init() {
    console.log('[PERMISSIONS] Inicializando manejador de permisos...');
    this.setupErrorHandlers();
  }

  setupErrorHandlers() {
    // Interceptar errores de Firestore
    if (window.firebase && window.firebase.firestore) {
      this.wrapFirestoreOperations();
    } else {
      window.addEventListener('firebaseReady', () => {
        this.wrapFirestoreOperations();
      });
    }
  }

  wrapFirestoreOperations() {
    // No podemos interceptar directamente, pero podemos proporcionar helpers
    console.log('[PERMISSIONS] Helpers de permisos disponibles');
  }

  /**
   * Verifica si el usuario actual tiene permisos de admin
   */
  async checkAdminPermissions() {
    try {
      const user = firebase.auth().currentUser;

      if (!user) {
        return {
          hasPermission: false,
          reason: 'not_authenticated',
          message: 'No hay usuario autenticado',
        };
      }

      // Verificar custom claim
      const idTokenResult = await user.getIdTokenResult();
      const hasAdminClaim = idTokenResult.claims.admin === true;

      if (hasAdminClaim) {
        return {
          hasPermission: true,
          reason: 'admin_claim',
          message: 'Usuario tiene custom claim de admin',
        };
      }

      // Fallback: verificar en Firestore (si tiene permisos para leer su propio documento)
      try {
        const userDoc = await firebase
          .firestore()
          .collection('users')
          .doc(user.uid)
          .get();

        if (userDoc.exists && userDoc.data().role === 'admin') {
          return {
            hasPermission: true,
            reason: 'firestore_role',
            message:
              'Usuario tiene role=admin en Firestore (pero falta custom claim)',
            warning:
              'Se recomienda asignar el custom claim para mejor rendimiento',
          };
        }
      } catch (firestoreError) {
        console.warn(
          '[PERMISSIONS] No se pudo verificar role en Firestore:',
          firestoreError
        );
      }

      return {
        hasPermission: false,
        reason: 'not_admin',
        message: 'Usuario no tiene permisos de administrador',
      };
    } catch (error) {
      console.error('[PERMISSIONS] Error verificando permisos:', error);
      return {
        hasPermission: false,
        reason: 'error',
        message: 'Error al verificar permisos: ' + error.message,
      };
    }
  }

  /**
   * Intenta ejecutar una operación de Firestore con manejo de errores mejorado
   */
  async executeWithPermissionCheck(operation, operationName = 'Operación') {
    try {
      // Verificar permisos primero
      const permissionCheck = await this.checkAdminPermissions();

      if (!permissionCheck.hasPermission) {
        return this.handlePermissionDenied(permissionCheck, operationName);
      }

      // Ejecutar operación
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      return this.handleFirestoreError(error, operationName);
    }
  }

  /**
   * Maneja errores de permisos denegados
   */
  handlePermissionDenied(permissionCheck, operationName) {
    const isAuthIssue =
      permissionCheck.reason === 'not_authenticated' ||
      permissionCheck.reason === 'not_admin';
    const logFn = isAuthIssue ? console.warn : console.error;
    logFn(
      `[PERMISSIONS] ❌ ${operationName} denegada:`,
      permissionCheck.message
    );

    const errorInfo = {
      success: false,
      error: 'permission_denied',
      message: permissionCheck.message,
      reason: permissionCheck.reason,
      userFriendlyMessage: this.getUserFriendlyMessage(permissionCheck.reason),
      instructions: this.getInstructions(permissionCheck.reason),
    };

    // Mostrar notificación al usuario
    this.showPermissionError(errorInfo);

    return errorInfo;
  }

  /**
   * Maneja errores de Firestore
   */
  handleFirestoreError(error, operationName) {
    const isAuthIssue =
      error?.code === 'permission-denied' || error?.code === 'unauthenticated';
    const logFn = isAuthIssue ? console.warn : console.error;
    logFn(`[PERMISSIONS] ❌ Error en ${operationName}:`, error);

    // Detectar tipo de error
    if (
      error.code === 'permission-denied' ||
      error.message.includes('insufficient permissions')
    ) {
      return {
        success: false,
        error: 'permission_denied',
        message: error.message,
        userFriendlyMessage: 'No tienes permisos para realizar esta operación',
        instructions: this.getInstructions('permission_denied'),
      };
    }

    if (error.code === 'unauthenticated') {
      return {
        success: false,
        error: 'not_authenticated',
        message: 'Usuario no autenticado',
        userFriendlyMessage: 'Debes iniciar sesión para continuar',
        instructions: ['Inicia sesión con tu cuenta de administrador'],
      };
    }

    // Error genérico
    return {
      success: false,
      error: 'unknown',
      message: error.message,
      userFriendlyMessage: 'Ocurrió un error inesperado',
      instructions: [
        'Recarga la página e intenta nuevamente',
        'Si el problema persiste, contacta al soporte',
      ],
    };
  }

  /**
   * Obtiene mensaje amigable según el tipo de error
   */
  getUserFriendlyMessage(reason) {
    const messages = {
      not_authenticated:
        'Debes iniciar sesión para acceder al panel de administración',
      not_admin: 'No tienes permisos de administrador',
      admin_claim_missing:
        'Tu cuenta no tiene los permisos necesarios configurados',
      permission_denied: 'No tienes permisos para realizar esta operación',
      error: 'Ocurrió un error al verificar tus permisos',
    };

    return messages[reason] || 'Error de permisos';
  }

  /**
   * Obtiene instrucciones según el tipo de error
   */
  getInstructions(reason) {
    const instructions = {
      not_authenticated: [
        '1. Inicia sesión con tu cuenta',
        '2. Asegúrate de usar una cuenta con permisos de administrador',
      ],
      not_admin: [
        '1. Contacta al administrador del sistema',
        '2. Solicita que te asignen permisos de administrador',
        '3. El administrador debe ejecutar: node scripts/setAdminClaim.js tu-email@example.com',
      ],
      admin_claim_missing: [
        '1. Ejecuta: node scripts/setAdminClaim.js tu-email@example.com',
        '2. Cierra sesión y vuelve a iniciar sesión',
        '3. Verifica que el claim se aplicó correctamente',
      ],
      permission_denied: [
        '1. Verifica que tienes permisos de administrador',
        '2. Cierra sesión y vuelve a iniciar sesión',
        '3. Si el problema persiste, ejecuta: node scripts/setAdminClaim.js tu-email@example.com',
      ],
    };

    return instructions[reason] || ['Contacta al administrador del sistema'];
  }

  /**
   * Muestra error de permisos al usuario
   */
  showPermissionError(errorInfo) {
    // Usar sistema de notificaciones si está disponible
    if (window.NotificationSystem) {
      window.NotificationSystem.error(errorInfo.userFriendlyMessage);
    }

    // Mostrar modal con instrucciones detalladas
    this.showPermissionModal(errorInfo);
  }

  /**
   * Muestra modal con instrucciones detalladas
   */
  showPermissionModal(errorInfo) {
    // Crear modal si no existe
    let modal = document.getElementById('permissionErrorModal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'permissionErrorModal';
      modal.className = 'modal permission-error-modal hidden';
      modal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modal);
    }

    // Contenido del modal
    modal.innerHTML = `
      <div class="permission-error-modal__content">
        <div class="permission-error-modal__header">
          <div class="permission-error-modal__icon" aria-hidden="true">⚠️</div>
          <h2 class="permission-error-modal__title">Error de Permisos</h2>
        </div>

        <p class="permission-error-modal__message">
          ${errorInfo.userFriendlyMessage}
        </p>

        <div class="permission-error-modal__instructions">
          <h3 class="permission-error-modal__instructions-title">
            Instrucciones para resolver:
          </h3>
          <ol class="permission-error-modal__instructions-list">
            ${errorInfo.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
          </ol>
        </div>

        <div class="permission-error-modal__details">
          <strong>Detalles técnicos:</strong><br>
          Razón: ${errorInfo.reason}<br>
          Mensaje: ${errorInfo.message}
        </div>

        <div class="permission-error-modal__actions">
          <button id="permissionModalCloseBtn" class="permission-error-modal__btn permission-error-modal__btn--secondary">
            Cerrar
          </button>
          <button id="permissionModalDocsBtn" class="permission-error-modal__btn permission-error-modal__btn--primary">
            Ver Documentación
          </button>
        </div>
      </div>
    `;

    // Agregar event listeners sin inline handlers
    const closeBtn = modal.querySelector('#permissionModalCloseBtn');
    const docsBtn = modal.querySelector('#permissionModalDocsBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.DOMUtils.setDisplay(modal, 'none');
        modal.setAttribute('aria-hidden', 'true');
      });
    }

    if (docsBtn) {
      docsBtn.addEventListener('click', () => {
        window.open('SOLUCION-PERMISOS-FIRESTORE-2026-01-22.md', '_blank');
      });
    }

    // Mostrar modal
    window.DOMUtils.setDisplay(modal, 'flex');
    modal.setAttribute('aria-hidden', 'false');

    // Cerrar con ESC
    const closeOnEsc = e => {
      if (e.key === 'Escape') {
        window.DOMUtils.setDisplay(modal, 'none');
        modal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    document.addEventListener('keydown', closeOnEsc);
  }

  /**
   * Verifica permisos y muestra advertencia si es necesario
   */
  async checkAndWarn() {
    const permissionCheck = await this.checkAdminPermissions();

    if (!permissionCheck.hasPermission) {
      console.warn('[PERMISSIONS] ⚠️ Usuario sin permisos de admin detectado');
      this.showPermissionError({
        userFriendlyMessage: permissionCheck.message,
        instructions: this.getInstructions(permissionCheck.reason),
        reason: permissionCheck.reason,
        message: permissionCheck.message,
      });
      return false;
    }

    if (permissionCheck.warning) {
      console.warn('[PERMISSIONS] ⚠️', permissionCheck.warning);
    }

    return true;
  }
}

export function initFirebasePermissionsHandler() {
  if (window.__FIREBASE_PERMISSIONS_HANDLER_INITED__) {
    return;
  }

  window.__FIREBASE_PERMISSIONS_HANDLER_INITED__ = true;
  window.FirebasePermissionsHandler = FirebasePermissionsHandler;

  if (!window.permissionsHandler) {
    window.permissionsHandler = new FirebasePermissionsHandler();
  }
}

export { FirebasePermissionsHandler };
