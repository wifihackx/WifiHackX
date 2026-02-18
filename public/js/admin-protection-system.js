/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ SISTEMA DE PROTECCIÓN DE ADMINISTRADOR - WifiHackX v1.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CARACTERÍSTICAS:
 * - ✅ Protección contra auto-baneo de administradores
 * - ✅ Verificación de Custom Claims antes de cualquier verificación de baneo
 * - ✅ Bypass automático para administradores
 * - ✅ Sistema de recuperación de emergencia
 * - ✅ Logs detallados de protección
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

function setupAdminProtectionSystem() {
  console.log(
    '🛡️ [ADMIN PROTECTION] Inicializando sistema de protección de administradores...'
  );

  const getAuth = () =>
    window.firebase && window.firebase.auth ? window.firebase.auth() : null;

  const getCurrentUser = () => {
    const auth = getAuth();
    return auth ? auth.currentUser : null;
  };

  const ensureAdminSettingsCache = async () => {
    if (window.AdminSettingsCache) return window.AdminSettingsCache;
    if (!getCurrentUser()) return null;
    if (window.AdminSettingsService?.getSettings) {
      const settings = await window.AdminSettingsService.getSettings({
        allowDefault: false,
      });
      if (settings) {
        window.AdminSettingsCache = settings;
        return settings;
      }
    }
    return window.AdminSettingsCache || null;
  };

  const getAdminAllowlist = () => {
    const emails = (window.AdminSettingsCache?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (window.AdminSettingsCache?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  };

  /**
   * Verificar si el usuario actual es administrador
   */
  async function isAdminUser(user) {
    if (!user) return false;

    try {
      const allowlist = getAdminAllowlist();

      if (window.AdminClaimsService?.isAdmin) {
        return await window.AdminClaimsService.isAdmin(user, allowlist);
      }

      // Fallback: allowlist + claims
      if (user.email && allowlist.emails.includes(user.email.toLowerCase())) {
        return true;
      }
      if (allowlist.uids.includes(user.uid)) {
        return true;
      }
      if (user.getIdTokenResult) {
        const claims = window.getAdminClaims
          ? await window.getAdminClaims(user, false)
          : (await user.getIdTokenResult(true)).claims;
        if (claims && claims.admin) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('🛡️ [ADMIN PROTECTION] Error verificando admin:', error);
      return false;
    }
  }

  /**
   * Sistema de protección para BanSystem
   */
  function protectBanSystem() {
    if (!window.BanSystem) return;

    console.log('🛡️ [ADMIN PROTECTION] Protegiendo BanSystem...');

    const originalShowBannedModal = window.BanSystem.showBannedModal;

    // Override de checkBanStatus
    const originalCheckBanStatus = window.BanSystem.checkBanStatus;
    window.BanSystem.checkBanStatus = async function (userId) {
      console.log(
        '🛡️ [ADMIN PROTECTION] Verificando ban status con protección...'
      );

      try {
        // Obtener usuario actual
        const currentUser = getCurrentUser();

        // Si es el mismo usuario y es admin, retornar null inmediatamente
        if (currentUser && currentUser.uid === userId) {
          const isAdmin = await isAdminUser(currentUser);
          if (isAdmin) {
            console.log(
              '🛡️ [ADMIN PROTECTION] ⚠️ Admin protegido contra baneo automático'
            );
            return null; // Nunca baneado
          }
        }

        // Si no es admin, continuar con verificación normal
        return originalCheckBanStatus
          ? originalCheckBanStatus.call(this, userId)
          : null;
      } catch (error) {
        console.error('🛡️ [ADMIN PROTECTION] Error en checkBanStatus:', error);
        return null; // Por seguridad, no banear si hay error
      }
    };

    // Override de showBannedModal
    window.BanSystem.showBannedModal = function (banInfo) {
      console.log(
        '🛡️ [ADMIN PROTECTION] Intento de mostrar modal de baneo:',
        banInfo
      );

      // Verificar si el usuario actual es admin
      const currentUser = getCurrentUser();
      if (currentUser) {
        isAdminUser(currentUser).then(isAdmin => {
          if (isAdmin) {
            console.log(
              '🛡️ [ADMIN PROTECTION] 🚫 Modal de baneo bloqueado para administrador'
            );
            return; // No mostrar modal a admins
          }

          // Si no es admin, mostrar modal (si existe la función original)
          console.log(
            '🛡️ [ADMIN PROTECTION] Usuario no es admin, permitiendo modal'
          );
          if (typeof originalShowBannedModal === 'function') {
            originalShowBannedModal.call(window.BanSystem, banInfo);
          }
        });
      }
    };

    console.log('✅ [ADMIN PROTECTION] BanSystem protegido');
  }

  /**
   * Sistema de recuperación de emergencia
   */
  function setupEmergencyRecovery() {
    console.log(
      '🛡️ [ADMIN PROTECTION] Configurando sistema de recuperación...'
    );

    // Crear función global de emergencia
    window.AdminEmergencyRecovery = {
      // Desbloquear admin inmediatamente
      unblockAdmin: async function () {
        console.log('🛡️ [EMERGENCY] Iniciando desbloqueo de admin...');

        try {
          const currentUser = getCurrentUser();
          if (currentUser && (await isAdminUser(currentUser))) {
            // Limpiar estado de baneo en AppState
            if (window.AppState) {
              window.AppState.setState('user.banned', false);
              window.AppState.setState('user.banStatus', null);
            }

            // Eliminar modal de baneo
            const banModal = document.getElementById('bannedUserModal');
            if (banModal) {
              banModal.remove();
            }

            console.log('✅ [EMERGENCY] Admin desbloqueado exitosamente');
            return true;
          }

          console.error('❌ [EMERGENCY] Usuario actual no es administrador');
          return false;
        } catch (error) {
          console.error('❌ [EMERGENCY] Error en desbloqueo:', error);
          return false;
        }
      },

      // Verificar estado de protección
      checkProtection: function () {
        const allowlist = getAdminAllowlist();
        return {
          banSystemProtected: !!window.BanSystem?.checkBanStatus,
          adminConfigLoaded:
            allowlist.emails.length > 0 || allowlist.uids.length > 0,
          currentUser: getCurrentUser()?.email || 'No autenticado',
        };
      },
    };

    // Acceso rápido con teclas de emergencia
    document.addEventListener('keydown', function (event) {
      // Ctrl+Shift+A para activar recuperación de admin
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        console.log('🛡️ [EMERGENCY] Activado por Ctrl+Shift+A');
        window.AdminEmergencyRecovery.unblockAdmin();
      }
    });

    console.log('✅ [ADMIN PROTECTION] Sistema de recuperación configurado');
  }

  /**
   * Sistema de monitoreo continuo
   */
  function setupMonitoring() {
    console.log('🛡️ [ADMIN PROTECTION] Configurando monitoreo continuo...');

    // Monitorear cambios de autenticación
    if (window.AppState) {
      window.AppState.subscribe('user', async user => {
        if (user && user.email) {
          const currentUser = getCurrentUser();
          const isAdmin = currentUser ? await isAdminUser(currentUser) : false;

          if (isAdmin) {
            console.log('🛡️ [MONITORING] Admin detectado:', user.email);

            // Asegurar que nunca esté baneado
            window.AppState.setState('user.banned', false);
            window.AppState.setState('user.banStatus', null);

            // Silencioso en UI: mantenemos protección activa sin mostrar toast.
          }
        }
      });
    }

    console.log('✅ [ADMIN PROTECTION] Monitoreo configurado');
  }

  /**
   * Inicialización del sistema
   */
  async function init() {
    console.log('🛡️ [ADMIN PROTECTION] Inicializando sistema completo...');

    // Esperar a que Firebase esté listo
    const maxWaitTime = 5000; // 5 segundos máximo
    const startTime = Date.now();

    while (!getAuth() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!getAuth()) {
      console.warn(
        '🛡️ [ADMIN PROTECTION] Firebase no disponible después de esperar'
      );
      return;
    }

    await ensureAdminSettingsCache();
    // Configurar todos los sistemas
    protectBanSystem();
    setupEmergencyRecovery();
    setupMonitoring();

    console.log(
      '🎉 [ADMIN PROTECTION] ✅ Sistema de protección de administradores completamente inicializado'
    );
    console.log(
      '🛡️ [ADMIN PROTECTION] 🔑 Acceso rápido: Ctrl+Shift+A para emergencia'
    );
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

function initAdminProtectionSystem() {
  if (window.__ADMIN_PROTECTION_SYSTEM_INITED__) {
    return;
  }

  window.__ADMIN_PROTECTION_SYSTEM_INITED__ = true;
  setupAdminProtectionSystem();
}

if (typeof window !== 'undefined' && !window.__ADMIN_PROTECTION_SYSTEM_NO_AUTO__) {
  initAdminProtectionSystem();
}

