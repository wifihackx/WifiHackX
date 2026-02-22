/**
 * Sistema de Notificaciones para Autenticación
 *
 * Proporciona mensajes consistentes y descriptivos para todas las operaciones
 * de autenticación del sistema WifiHackX.
 *
 * @author Kiro AI
 * @version 1.0.0
 */

export function initAuthNotifications() {
  'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

  if (window.__AUTH_NOTIFICATIONS_INITED__) {
    return;
  }
  window.__AUTH_NOTIFICATIONS_INITED__ = true;

  // Mensajes de éxito
  const SUCCESS_MESSAGES = {
    loginSuccess: displayName => `¡Bienvenido ${displayName}!`,
    loginInProgress: 'Iniciando sesión...',
    registerSuccess: email =>
      `✅ Cuenta creada exitosamente. Te enviamos un email de verificación a ${email}. Por favor verifica tu email antes de iniciar sesión.`,
    registerInProgress: 'Creando cuenta...',
    logoutSuccess: 'Sesión cerrada correctamente',
    passwordResetSent: email =>
      `✅ Email de recuperación enviado a ${email}. Revisa tu bandeja de entrada y spam.`,
    passwordResetInProgress: 'Enviando email de recuperación...',
    emailVerificationSent:
      '✅ Email de verificación reenviado. Revisa tu bandeja de entrada.',
    sessionExtended: 'Sesión extendida correctamente',
    sessionCreated: 'Sesión iniciada correctamente',
  };

  // Mensajes de error
  const ERROR_MESSAGES = {
    // Errores de login
    'auth/user-not-found': 'Usuario no encontrado. ¿Necesitas registrarte?',
    'auth/wrong-password': 'Contraseña incorrecta. ¿Olvidaste tu contraseña?',
    'auth/invalid-email': 'El formato del email no es válido',
    'auth/user-disabled':
      'Esta cuenta ha sido deshabilitada. Contacta al administrador',
    'auth/too-many-requests':
      'Demasiados intentos fallidos. Intenta más tarde o restablece tu contraseña',
    'auth/invalid-credential':
      'Credenciales inválidas. Verifica tu email y contraseña',

    // Errores de registro
    'auth/email-already-in-use':
      '❌ Este email ya está registrado. ¿Quieres iniciar sesión?',
    'auth/weak-password':
      'La contraseña es muy débil. Usa al menos 6 caracteres',
    'auth/operation-not-allowed':
      'Esta operación no está permitida. Contacta al administrador',

    // Errores de Google Sign-In
    'auth/popup-closed-by-user': 'Ventana de login cerrada. Intenta de nuevo',
    'auth/popup-blocked':
      'El navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes para este sitio',
    'auth/cancelled-popup-request': 'Operación cancelada. Intenta de nuevo',
    'auth/account-exists-with-different-credential':
      'Ya existe una cuenta con este email usando otro método de login',

    // Errores de red
    'auth/network-request-failed':
      'Error de red. Por favor, revisa tu conexión a internet',
    'auth/timeout': 'Tiempo de espera agotado. Intenta de nuevo',

    // Errores internos
    'auth/internal-error':
      'Error interno del servidor. Intenta de nuevo más tarde',
    'auth/invalid-api-key': 'Error de configuración. Contacta al administrador',
    'auth/app-deleted': 'Error de configuración. Contacta al administrador',

    // Errores de validación
    'validation/empty-fields': 'Por favor completa todos los campos',
    'validation/invalid-email': 'Por favor ingresa un email válido',
    'validation/password-too-short':
      'La contraseña debe tener al menos 6 caracteres',
    'validation/password-too-long': 'La contraseña es demasiado larga',
    'validation/passwords-mismatch': 'Las contraseñas no coinciden',
    'validation/email-not-verified':
      '⚠️ Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada y spam.',

    // Errores de sesión
    'session/user-banned': reason =>
      `🚫 Tu cuenta ha sido suspendida. Motivo: ${reason}`,
    'session/expired': 'Tu sesión ha expirado',

    // Error genérico
    generic: message => `Error: ${message}`,
  };

  // Mensajes de advertencia
  const WARNING_MESSAGES = {
    cartEmpty: 'Tu carrito está vacío',
    sessionExpiring: timeRemaining =>
      `⚠️ Tu sesión expirará en ${timeRemaining}`,
    emailNotVerified:
      '⚠️ Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada y spam.',
  };

  // Mensajes informativos
  const INFO_MESSAGES = {
    checkoutProcessing: 'Procesando pago... (demo)',
    loadingData: 'Cargando datos...',
    savingChanges: 'Guardando cambios...',
  };

  /**
   * Muestra un mensaje de éxito
   * @param {string} key - Clave del mensaje
   * @param {*} params - Parámetros adicionales para el mensaje
   */
  function showSuccess(key, params) {
    const messageTemplate = SUCCESS_MESSAGES[key];
    if (!messageTemplate) {
      console.warn(`Mensaje de éxito no encontrado: ${key}`);
      return;
    }

    const message =
      typeof messageTemplate === 'function'
        ? messageTemplate(params)
        : messageTemplate;

    if (window.NotificationSystem) {
      window.NotificationSystem.success(message);
    } else {
      debugLog(`✅ ${message}`);
    }
  }

  /**
   * Muestra un mensaje de error
   * @param {string} errorCodeOrKey - Código de error de Firebase o clave personalizada
   * @param {*} params - Parámetros adicionales para el mensaje
   */
  function showError(errorCodeOrKey, params) {
    const messageTemplate = ERROR_MESSAGES[errorCodeOrKey];

    let message;
    if (messageTemplate) {
      message =
        typeof messageTemplate === 'function'
          ? messageTemplate(params)
          : messageTemplate;
    } else {
      // Si no hay mensaje específico, usar el genérico
      message = ERROR_MESSAGES.generic(errorCodeOrKey);
    }

    if (window.NotificationSystem) {
      window.NotificationSystem.error(message);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Muestra un mensaje de advertencia
   * @param {string} key - Clave del mensaje
   * @param {*} params - Parámetros adicionales para el mensaje
   */
  function showWarning(key, params) {
    const messageTemplate = WARNING_MESSAGES[key];
    if (!messageTemplate) {
      console.warn(`Mensaje de advertencia no encontrado: ${key}`);
      return;
    }

    const message =
      typeof messageTemplate === 'function'
        ? messageTemplate(params)
        : messageTemplate;

    if (window.NotificationSystem) {
      window.NotificationSystem.warning(message);
    } else {
      console.warn(`⚠️ ${message}`);
    }
  }

  /**
   * Muestra un mensaje informativo
   * @param {string} key - Clave del mensaje
   * @param {*} params - Parámetros adicionales para el mensaje
   */
  function showInfo(key, params) {
    const messageTemplate = INFO_MESSAGES[key];
    if (!messageTemplate) {
      console.warn(`Mensaje informativo no encontrado: ${key}`);
      return;
    }

    const message =
      typeof messageTemplate === 'function'
        ? messageTemplate(params)
        : messageTemplate;

    if (window.NotificationSystem) {
      window.NotificationSystem.info(message);
    } else {
      debugLog(`ℹ️ ${message}`);
    }
  }

  /**
   * Maneja errores de Firebase Auth y muestra el mensaje apropiado
   * @param {Error} error - Error de Firebase Auth
   * @param {string} operation - Nombre de la operación (para logging)
   */
  function handleAuthError(error, operation = 'autenticación') {
    console.error(`Error en ${operation}:`, error);
    console.error('Código de error:', error.code);
    console.error('Mensaje de error:', error.message);

    showError(error.code || 'generic', error.message);
  }

  /**
   * Muestra indicador de carga para operaciones de autenticación
   * @param {string} operation - Tipo de operación ('login', 'register', 'passwordReset')
   * @returns {Function} - Función para ocultar el indicador
   */
  function showLoadingIndicator(operation) {
    const messages = {
      login: 'loginInProgress',
      register: 'registerInProgress',
      passwordReset: 'passwordResetInProgress',
    };

    const key = messages[operation] || 'loadingData';
    showInfo(key);

    // Retornar función para ocultar (aunque las notificaciones se auto-ocultan)
    return () => {
      // Las notificaciones de tipo "info" se auto-ocultan
    };
  }

  // Exponer API pública
  window.AuthNotifications = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    handleAuthError,
    showLoadingIndicator,

    // Acceso directo a mensajes para casos especiales
    messages: {
      success: SUCCESS_MESSAGES,
      error: ERROR_MESSAGES,
      warning: WARNING_MESSAGES,
      info: INFO_MESSAGES,
    },
  };

  debugLog('✅ Sistema de notificaciones de autenticación inicializado');
}

if (typeof window !== 'undefined' && !window.__AUTH_NOTIFICATIONS_NO_AUTO__) {
  initAuthNotifications();
}


