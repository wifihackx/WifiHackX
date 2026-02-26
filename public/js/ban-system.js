/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚨 SISTEMA DE BANEO AVANZADO - WifiHackX v2.3.0 (ULTRA-ROBUSTO)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NUEVAS CARACTERÍSTICAS v2.3.0:
 * - ✅ Baneos Temporales (1, 3, 7, 30 días)
 * - ✅ Verificación de Expiración Automática
 * - ✅ Registro de IPs y Bloqueo por IP
 * - ✅ Historial Detallado de Acciones
 *
 * @version 2.3.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupBanSystem() {
  if (window.BanSystem) {
    return;
  }

  debugLog(
    '[BAN SYSTEM] 🚀 Inicializando sistema de baneo v2.3.0 con protección de administradores...'
  );

  // 🔥 PROTECCIÓN DE ADMINISTRADORES ACTIVADA
  debugLog('[BAN SYSTEM] 🛡️ Protección de administradores activada');
  let bannedAutoLogoutTimer = null;

  async function getAdminAllowlist() {
    if (window.AdminSettingsService?.getAllowlist) {
      return window.AdminSettingsService.getAllowlist({ allowDefault: false });
    }
    const emails = (window.AdminSettingsCache?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (window.AdminSettingsCache?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  }

  /**
   * Verificar si el usuario es administrador protegido
   */
  async function isProtectedAdmin(user) {
    if (!user) return false;

    try {
      const allowlist = await getAdminAllowlist();

      // Verificar por email
      if (user.email && allowlist.emails.includes(user.email.toLowerCase())) {
        debugLog('[BAN SYSTEM] 🛡️ Admin protegido detectado por email:', user.email);
        return true;
      }

      // Verificar por UID
      if (allowlist.uids.includes(user.uid)) {
        debugLog('[BAN SYSTEM] 🛡️ Admin protegido detectado por UID:', user.uid);
        return true;
      }

      // Verificar por Custom Claims
      if (user.getIdTokenResult) {
        const claims = window.getAdminClaims
          ? await window.getAdminClaims(user, false)
          : (await user.getIdTokenResult(true)).claims;
        if (claims && claims.admin) {
          debugLog('[BAN SYSTEM] 🛡️ Admin protegido detectado por Custom Claims:', user.email);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('[BAN SYSTEM] Error verificando admin protegido:', error);
      return false;
    }
  }

  const BAN_REASONS = {
    spam: 'Publicación de spam o contenido no deseado',
    abuse: 'Comportamiento abusivo o acoso',
    fraud: 'Actividad fraudulenta o engañosa',
    violation: 'Violación de términos de servicio',
    security: 'Amenaza de seguridad',
    copyright: 'Violación de derechos de autor',
    other: 'Otro motivo',
  };

  /**
   * FUNCIÓN DE EMERGENCIA: Limpiar IPs baneadas que afecten administradores
   */
  async function emergencyClearIPBans() {
    debugLog('[BAN SYSTEM] 🚨 EMERGENCIA: Limpiando IPs baneadas...');

    try {
      const db = firebase.firestore();
      const bannedIPsSnapshot = await db.collection('bannedIPs').get();

      let clearedCount = 0;
      const batch = db.batch();

      for (const doc of bannedIPsSnapshot.docs) {
        const _ipData = doc.data();

        // Verificar si esta IP pertenece a algún administrador
        const usersWithIP = await db.collection('users').where('lastIP', '==', doc.id).get();

        let hasAdmin = false;
        for (const userDoc of usersWithIP.docs) {
          try {
            // Verificar si el usuario tiene role admin en Firestore
            const userData = userDoc.data();
            if (userData && userData.role === 'admin') {
              hasAdmin = true;
              debugLog('[BAN SYSTEM] 🛡️ IP pertenece a administrador:', userDoc.id, userData.email);
              break;
            }
          } catch (_e) {
            // Ignorar errores de verificación
          }
        }

        if (hasAdmin) {
          batch.delete(doc.ref);
          clearedCount++;
        }
      }

      if (clearedCount > 0) {
        await batch.commit();
        debugLog(
          `[BAN SYSTEM] ✅ ${clearedCount} IPs baneadas eliminadas (afectaban administradores)`
        );
      } else {
        debugLog('[BAN SYSTEM] ✅ No se encontraron IPs baneadas que afecten administradores');
      }

      return clearedCount;
    } catch (error) {
      console.error('[BAN SYSTEM] Error limpiando IPs baneadas:', error);
      return 0;
    }
  }

  /**
   * FUNCIÓN DE EMERGENCIA: Desbanear administrador accidentalmente baneado
   */
  async function emergencyUnbanAdmin(adminEmail) {
    debugLog('[BAN SYSTEM] 🚨 EMERGENCIA: Desbaneando administrador:', adminEmail);

    try {
      const db = firebase.firestore();

      // Buscar usuario por email
      const usersSnapshot = await db.collection('users').where('email', '==', adminEmail).get();

      if (usersSnapshot.empty) {
        console.error('[BAN SYSTEM] Administrador no encontrado:', adminEmail);
        return false;
      }

      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;

      // Verificar que sea administrador via Firestore role
      const userData = userDoc.data();
      const isAdmin = userData && userData.role === 'admin';

      if (!isAdmin) {
        console.error('[BAN SYSTEM] Usuario no es administrador:', adminEmail);
        return false;
      }

      // Desbanear
      await db.collection('users').doc(userId).update({
        banned: false,
        status: 'active',
        banReason: null,
        banReasonCode: null,
        banDetails: null,
        banExpires: null,
        banType: null,
        bannedAt: null,
        bannedBy: null,
        bannedByEmail: null,
      });

      // Log de emergencia
      await db.collection('banLogs').add({
        userId,
        action: 'emergency_unban',
        adminId: 'system',
        adminEmail: 'emergency_recovery',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        details: `Emergency unban for admin: ${adminEmail}`,
      });

      debugLog('[BAN SYSTEM] ✅ Administrador desbaneado exitosamente:', adminEmail);
      return true;
    } catch (error) {
      console.error('[BAN SYSTEM] Error en emergency unban:', error);
      return false;
    }
  }

  /**
   * Verificar estado de baneo de un usuario
   */
  async function checkUserBanStatus(userId) {
    try {
      debugLog('[BAN SYSTEM] Verificando usuario:', userId);

      // Validar que userId existe
      if (!userId) {
        debugLog('[BAN SYSTEM] userId es null o undefined, retornando null');
        return null;
      }

      // 🔒 PROTECCIÓN CRÍTICA: Verificar si es administrador ANTES de cualquier verificación de baneo
      try {
        const currentUser = firebase.auth().currentUser;

        // Si es el usuario actual, verificar con protección
        if (currentUser && currentUser.uid === userId) {
          const isProtected = await isProtectedAdmin(currentUser);
          if (isProtected) {
            debugLog(
              '[BAN SYSTEM] 🛡️ Usuario administrador protegido - omitiendo verificación de baneo'
            );
            return null; // Los administradores protegidos nunca son baneados
          }
        }

        // Verificación adicional para el usuario actual
        if (currentUser && currentUser.uid === userId) {
          const token = await currentUser.getIdTokenResult();
          const isAdmin = !!token.claims.admin;

          if (isAdmin) {
            debugLog('[BAN SYSTEM] 🔒 Usuario es administrador - omitiendo verificación de baneo');
            return null; // Los administradores nunca son baneados
          }
        }
      } catch (claimsError) {
        console.warn('[BAN SYSTEM] No se pudieron verificar Custom Claims:', claimsError);
        // Continuar con verificación normal si fallan los claims
      }

      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        debugLog('[BAN SYSTEM] Usuario no existe en Firestore');
        return null;
      }

      const userData = userDoc.data();

      // Validar que userData existe
      if (!userData) {
        console.warn('[BAN SYSTEM] ⚠️ userData es undefined');
        return null;
      }

      // 1. Verificar baneo Permanente o Estado
      const isBannedPermanent = userData.banned === true;
      const isBannedOld = userData.status === 'banned';

      // 2. Verificar baneo Temporal
      if (userData.banExpires) {
        const banExpires = userData.banExpires.toDate();
        const now = new Date();

        if (now < banExpires) {
          console.warn('[BAN SYSTEM] ⚠️ Baneo temporal activo hasta:', banExpires);
          return {
            banned: true,
            type: 'temporary',
            reason: userData.banReason || 'Baneo temporal',
            expiresAt: banExpires,
          };
        } else {
          // Expiró, desbanear automáticamente
          debugLog('[BAN SYSTEM] ⏰ Baneo temporal expirado, ejecutando auto-unban...');
          await autoUnbanUser(userId);
          return null;
        }
      }

      if (isBannedPermanent || isBannedOld) {
        console.warn('[BAN SYSTEM] ⚠️ Baneo permanente detectado');
        return {
          banned: true,
          type: 'permanent',
          reason: userData.banReason || 'Violación de términos',
          reasonCode: userData.banReasonCode || 'other',
          details: userData.banDetails || '',
        };
      }

      // 3. Verificar baneo por IP (solo para no-administradores)
      if (userData.lastIP) {
        const ipBanned = await checkIPBan(userData.lastIP);
        if (ipBanned) {
          return {
            banned: true,
            type: 'ip',
            reason: 'Dirección IP bloqueada',
          };
        }
      }

      debugLog('[BAN SYSTEM] Usuario no está baneado');
      return null;
    } catch (error) {
      console.error('[BAN SYSTEM] ❌ Error verificando ban status:', error);
      return null;
    }
  }

  /**
   * Obtiene la IP actual del usuario
   */
  async function _getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (e) {
      console.error('[BAN SYSTEM] No se pudo obtener IP:', e);
      return null;
    }
  }

  /**
   * Banea a un usuario
   */
  async function banUser(userId, reasonCode, details = '', durationDays = 'permanent') {
    try {
      debugLog('[BAN SYSTEM] Ejecutando baneo:', {
        userId,
        reasonCode,
        durationDays,
      });

      if (!userId || !reasonCode) throw new Error('userId y reasonCode son requeridos');
      const adminUser = firebase.auth().currentUser;
      if (!adminUser) throw new Error('No autenticado como administrador');

      const db = firebase.firestore();

      // PROTECCIÓN: Verificar que el usuario a banear NO sea administrador
      const targetUserDoc = await db.collection('users').doc(userId).get();
      if (!targetUserDoc.exists) {
        throw new Error('Usuario no encontrado');
      }

      const targetUserData = targetUserDoc.data();

      // VERIFICACIÓN DE SEGURIDAD: Verificar role en Firestore
      // Los administradores protegidos no pueden ser baneados
      if (targetUserData.role === 'admin') {
        console.error(
          '[BAN SYSTEM] 🛡️ BLOQUEADO: Intento de banear administrador protegido',
          userId,
          targetUserData.email
        );
        throw new Error('🛡️ ERROR DE SEGURIDAD: No se puede banear a un administrador protegido');
      }

      // Verificación adicional: allowlist dinámica (emails/UIDs protegidos)
      const allowlist = await getAdminAllowlist();
      const targetEmail = (targetUserData.email || '').toLowerCase();
      if (
        (targetEmail && allowlist.emails.includes(targetEmail)) ||
        allowlist.uids.includes(userId)
      ) {
        console.error(
          '[BAN SYSTEM] 🛡️ BLOQUEADO: Intento de banear administrador en lista protegida',
          userId,
          targetUserData.email
        );
        throw new Error('🛡️ ERROR DE SEGURIDAD: No se puede banear a un administrador protegido');
      }

      const banData = {
        banned: true,
        status: 'banned',
        banReason: BAN_REASONS[reasonCode] || reasonCode,
        banReasonCode: reasonCode,
        banDetails: details,
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        bannedBy: adminUser.uid,
        bannedByEmail: adminUser.email,
      };

      // Manejar duración
      if (durationDays !== 'permanent') {
        const days = parseInt(durationDays);
        const expires = new Date();
        expires.setDate(expires.getDate() + days);
        banData.banExpires = firebase.firestore.Timestamp.fromDate(expires);
        banData.banType = 'temporary';
      } else {
        banData.banType = 'permanent';
        banData.banExpires = null;
      }

      await db.collection('users').doc(userId).update(banData);

      // Log de acción (best-effort: no debe revertir un baneo ya aplicado)
      try {
        await db.collection('banLogs').add({
          userId,
          action: 'ban',
          type: banData.banType,
          expires: banData.banExpires,
          reason: banData.banReason,
          details: details,
          adminId: adminUser.uid,
          adminEmail: adminUser.email,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logError) {
        console.warn('[BAN SYSTEM] banLogs falló, baneo aplicado igualmente:', logError);
      }

      if (window.showNotification) {
        window.showNotification('Usuario baneado correctamente', 'success');
      }

      // Recargar UI (no debe romper el flujo principal de baneo)
      try {
        refreshUsersUI();
      } catch (uiError) {
        console.warn('[BAN SYSTEM] refreshUsersUI falló tras ban:', uiError);
      }
      return true;
    } catch (error) {
      console.error('[BAN SYSTEM] ❌ Error en banUser:', error);
      throw error;
    }
  }

  /**
   * Desbanea a un usuario
   */
  async function unbanUser(userId) {
    try {
      debugLog('[BAN SYSTEM] Desbaneando usuario:', userId);
      const adminUser = firebase.auth().currentUser;

      const db = firebase.firestore();
      await db.collection('users').doc(userId).update({
        banned: false,
        status: 'active',
        banReason: null,
        banReasonCode: null,
        banExpires: null,
        banType: null,
        banDetails: null,
      });

      await db.collection('banLogs').add({
        userId,
        action: 'unban',
        adminId: adminUser ? adminUser.uid : 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (window.showNotification) {
        window.showNotification('Usuario desbaneado correctamente', 'success');
      }

      refreshUsersUI();
      return true;
    } catch (error) {
      console.error('[BAN SYSTEM] ❌ Error en unbanUser:', error);
      throw error;
    }
  }

  /**
   * Desbaneo automático por expiración
   */
  async function autoUnbanUser(userId) {
    debugLog('[BAN SYSTEM] 🤖 Auto-unban para:', userId);
    return await unbanUser(userId);
  }

  /**
   * Verifica si una IP está baneada
   */
  async function checkIPBan(ip) {
    if (!ip) return false;
    try {
      const doc = await firebase.firestore().collection('bannedIPs').doc(ip).get();
      return doc.exists;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Muestra el modal de bloqueo al usuario
   */
  function showBannedModal(banStatus) {
    // SAFETY CHECK 1: Verificar que el banStatus es válido
    if (!banStatus || !banStatus.banned || !banStatus.reason) {
      debugLog('[BAN SYSTEM] showBannedModal: banStatus inválido, ignorando');
      return;
    }

    // SAFETY CHECK 2: Verificar que el usuario actual está autenticado
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      debugLog('[BAN SYSTEM] showBannedModal: No hay usuario autenticado, ignorando');
      return;
    }

    debugLog('[BAN SYSTEM] Mostrando modal de baneo:', banStatus);

    // Buscar el modal con múltiples intentos
    const modal = document.getElementById('bannedUserModal');
    const messageEl = document.getElementById('bannedUserMessage');

    // Debug: Verificar si el modal existe
    debugLog('[BAN SYSTEM] Modal encontrado:', !!modal);
    debugLog('[BAN SYSTEM] Message element encontrado:', !!messageEl);

    if (!modal) {
      console.error('[BAN SYSTEM] ERROR: Modal bannedUserModal no encontrado en el DOM');
      // Fallback a alert
      alert(
        `ACCESO DENEGADO\n\nTu cuenta ha sido suspendida.\n\nMotivo: ${banStatus.reason}\n\n${banStatus.details || ''}\n\nSi crees que esto es un error, contacta al administrador.`
      );
      return;
    }

    if (modal && messageEl) {
      debugLog('[BAN SYSTEM] Configurando modal...');
      if (modal.dataset.banCancelGuardBound !== '1') {
        modal.addEventListener('cancel', event => {
          event.preventDefault();
        });
        modal.dataset.banCancelGuardBound = '1';
      }

      // Construir mensaje completo y detallado
      let msg = `Tu cuenta ha sido suspendida.\n\n`;
      msg += `📋 Motivo: ${banStatus.reason}\n\n`;

      if (banStatus.details) {
        msg += `📝 Detalles: ${banStatus.details}\n\n`;
      }

      if (banStatus.expiresAt) {
        msg += `⏰ Expira el: ${banStatus.expiresAt.toLocaleString()}\n\n`;
      } else {
        msg += `⚠️ Tipo: Baneo permanente\n\n`;
      }

      msg += `Si crees que esto es un error, contacta al administrador.`;

      messageEl.innerText = msg;

      // NUEVA ESTRATEGIA: Usar clase específica para mostrar el modal
      // Esto evita el parpadeo porque el CSS mantiene el modal oculto hasta que se agregue esta clase
      modal.classList.remove('hidden', 'modal-hidden');
      if (typeof modal.showModal === 'function') {
        try {
          if (!modal.open) modal.showModal();
        } catch (_e) {
          window.DOMUtils.setDisplay(modal, 'flex');
        }
      } else {
        window.DOMUtils.setDisplay(modal, 'flex');
      }
      modal.classList.add('show-banned-modal');
      modal.setAttribute('aria-hidden', 'false');

      // Bloquear scroll del body
      window.DOMUtils.lockBodyScroll(true);

      debugLog('[BAN SYSTEM] Modal configurado con clase show-banned-modal');

      // Verificar que el modal sea visible
      setTimeout(() => {
        const rect = modal.getBoundingClientRect();
        debugLog('[BAN SYSTEM] Modal rect:', rect);
        if (rect.width === 0 || rect.height === 0) {
          console.error('[BAN SYSTEM] ERROR: Modal no visible despite styles');
        }
      }, 100);

      // Reasignar handler del botón de logout sin clonar el nodo.
      const bannedLogoutBtn = document.getElementById('bannedLogoutBtn');
      if (bannedLogoutBtn) {
        if (bannedLogoutBtn.dataset.boundLogout !== '1') {
          bannedLogoutBtn.dataset.boundLogout = '1';
          debugLog('[BAN SYSTEM] Registrando handler para bannedLogoutBtn');
          bannedLogoutBtn.addEventListener('click', () => {
            debugLog('[BAN SYSTEM] 🚪 Banned user logging out...');
            if (bannedAutoLogoutTimer) {
              clearTimeout(bannedAutoLogoutTimer);
              bannedAutoLogoutTimer = null;
            }
            if (window.firebase && firebase.auth) {
              firebase
                .auth()
                .signOut()
                .then(() => {
                  location.reload();
                })
                .catch(err => {
                  console.error('Error signing out:', err);
                  location.reload();
                });
            } else {
              location.reload();
            }
          });
        }
      } else {
        console.error('[BAN SYSTEM] ERROR: bannedLogoutBtn no encontrado');
      }

      // Aumentar tiempo de auto-logout a 30 segundos para que el usuario pueda leer
      if (bannedAutoLogoutTimer) {
        clearTimeout(bannedAutoLogoutTimer);
        bannedAutoLogoutTimer = null;
      }
      bannedAutoLogoutTimer = setTimeout(() => {
        debugLog('[BAN SYSTEM] Ejecutando auto-logout...');
        // Intentar hacer logout si todavía hay una sesión
        if (firebase.auth().currentUser) {
          firebase
            .auth()
            .signOut()
            .then(() => {
              window.location.reload();
            });
        } else {
          // Si no hay sesión, simplemente recargar
          window.location.reload();
        }
        bannedAutoLogoutTimer = null;
      }, 30000); // 30 segundos en lugar de 10
    } else {
      console.error('[BAN SYSTEM] ERROR: Modal o message element no encontrado');
      // Fallback si no existe el modal
      let alertMsg = `ACCESO DENEGADO\n\nTu cuenta ha sido suspendida.\n\nMotivo: ${banStatus.reason}`;
      if (banStatus.details) {
        alertMsg += `\n\nDetalles: ${banStatus.details}`;
      }
      if (banStatus.expiresAt) {
        alertMsg += `\n\nExpira: ${banStatus.expiresAt.toLocaleString()}`;
      }
      alertMsg += `\n\nSi crees que esto es un error, contacta al administrador.`;
      alert(alertMsg);

      // Intentar logout si hay sesión
      if (firebase.auth().currentUser) {
        firebase
          .auth()
          .signOut()
          .then(() => location.reload());
      } else {
        location.reload();
      }
    }
  }

  /**
   * Utilidad para refrescar la UI de administración
   */
  function refreshUsersUI() {
    if (window.usersManager && typeof window.usersManager.loadUsers === 'function') {
      window.usersManager.loadUsers();
    }
  }

  /**
   * Inicializa el observador de cambios de usuario vía AppState (Unificado)
   */
  function initLoginGuard() {
    // CRITICAL: Solo inicializar si estamos en una página que requiere autenticación
    // NO inicializar en la página de inicio (homeView)
    const currentView = document.body.getAttribute('data-current-view');
    if (currentView === 'homeView') {
      debugLog('[BAN SYSTEM] ⏸️ Página de inicio detectada - NO inicializando guard');
      return;
    }

    if (window.AppState) {
      debugLog('[BAN SYSTEM] 📡 Subscribing to AppState user changes...');
      window.AppState.subscribe('user', async user => {
        // CRITICAL: Verificar que el usuario existe Y está autenticado
        if (!user || !user.isAuthenticated || !user.uid) {
          debugLog('[BAN SYSTEM] Usuario no autenticado o sin UID, ignorando');
          return;
        }

        debugLog('[BAN SYSTEM] Usuario autenticado detectado:', user.uid);

        // 1. Verificar Ban Status
        const banStatus = await checkUserBanStatus(user.uid);

        // SAFETY CHECK: Solo mostrar modal si banStatus es válido
        if (banStatus && banStatus.banned === true && banStatus.reason) {
          debugLog('[BAN SYSTEM] Usuario baneado detectado, mostrando modal');
          showBannedModal(banStatus);
          return;
        } else {
          debugLog('[BAN SYSTEM] Usuario no baneado o banStatus inválido');
        }

        // 2. Actualizar IP si es posible
        setTimeout(() => {
          // Código para actualizar IP (si es necesario)
        }, 1000);
      });
    } else {
      debugLog('[BAN SYSTEM] AppState no disponible, usando fallback');
      // Fallback si AppState no está disponible
      firebase.auth().onAuthStateChanged(async user => {
        // CRITICAL: Verificar que el usuario existe
        if (!user || !user.uid) {
          debugLog('[BAN SYSTEM] Usuario no autenticado (fallback), ignorando');
          return;
        }

        debugLog('[BAN SYSTEM] Usuario autenticado (fallback):', user.uid);
        const banStatus = await checkUserBanStatus(user.uid);

        // SAFETY CHECK: Solo mostrar modal si banStatus es válido
        if (banStatus && banStatus.banned === true && banStatus.reason) {
          debugLog('[BAN SYSTEM] Usuario baneado detectado (fallback), mostrando modal');
          showBannedModal(banStatus);
        } else {
          debugLog('[BAN SYSTEM] Usuario no baneado o banStatus inválido (fallback)');
        }
      });
    }
  }

  function closeBanReasonModal() {
    debugLog('[BAN SYSTEM] Cerrando modal de baneo');
    const modal = document.getElementById('banReasonModal');
    if (modal) {
      if (typeof modal.close === 'function' && modal.open) {
        modal.close();
      } else {
        window.DOMUtils.setDisplay(modal, 'none');
      }
      modal.classList.add('modal-hidden');
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }

    // Desbloquear scroll
    if (window.unlockScroll) window.unlockScroll();
    else window.DOMUtils.lockBodyScroll(false);

    // Resetear formulario
    const form = document.getElementById('banReasonForm');
    if (form) form.reset();

    // Limpiar campos
    const userIdInput = document.getElementById('banTargetUserId');
    const userEmailInput = document.getElementById('banTargetUserEmail');
    if (userIdInput) userIdInput.value = '';
    if (userEmailInput) userEmailInput.value = '';
    setConfirmButtonState(false);

    debugLog('[BAN SYSTEM] Modal cerrado correctamente');
  }

  function getBanButtonLabel(key, fallback) {
    const currentLang =
      window.AppState?.getState?.('i18n.currentLanguage') || window.currentLanguage || 'es';
    const langPack = window.translations?.[currentLang] || window.translations?.es || {};
    return langPack[key] || fallback;
  }

  function setConfirmButtonState(isArmed) {
    const confirmBtn = document.getElementById('confirmBanBtn');
    if (!confirmBtn) return;
    const label = isArmed
      ? getBanButtonLabel('ban_confirm', 'Confirmar Baneo')
      : getBanButtonLabel('ban_title', 'Banear');
    confirmBtn.dataset.confirmArmed = isArmed ? '1' : '0';
    confirmBtn.classList.toggle('is-armed', isArmed);
    confirmBtn.setAttribute('aria-label', label);
    const textNode = confirmBtn.querySelector('span');
    if (textNode) textNode.textContent = label;
    else confirmBtn.textContent = label;
  }

  function showBanModal(userId, userEmail) {
    debugLog('[BAN SYSTEM] Mostrando modal de baneo para:', userEmail);
    if (!userId || !userEmail) {
      console.warn('[BAN SYSTEM] ⚠️ userId o userEmail inválidos, ignorando apertura');
      return;
    }
    const currentView = document.body.getAttribute('data-current-view');
    const adminView = document.getElementById('adminView');
    const isAdminViewActive =
      currentView === 'adminView' || (adminView && adminView.classList.contains('active'));
    if (!isAdminViewActive) {
      console.warn('[BAN SYSTEM] ⚠️ Intento de abrir modal de baneo fuera de adminView, ignorando');
      return;
    }
    const modal = document.getElementById('banReasonModal');
    if (!modal) {
      console.error('[BAN SYSTEM] Modal no encontrado');
      return;
    }

    const emailDisplay = document.getElementById('banUserEmailDisplay');
    const userIdInput = document.getElementById('banTargetUserId');
    const userEmailInput = document.getElementById('banTargetUserEmail');

    // Resetear el formulario
    const form = document.getElementById('banReasonForm');
    if (form) form.reset();
    setConfirmButtonState(false);

    if (emailDisplay) emailDisplay.textContent = userEmail;
    if (userIdInput) userIdInput.value = userId;
    if (userEmailInput) userEmailInput.value = userEmail;

    // Mostrar modal
    modal.classList.remove('modal-hidden');
    modal.classList.add('active');
    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch (_e) {
        window.DOMUtils.setDisplay(modal, 'flex');
      }
    } else {
      window.DOMUtils.setDisplay(modal, 'flex');
    }
    modal.setAttribute('aria-hidden', 'false');

    // Bloquear scroll
    if (window.lockScroll) window.lockScroll();
    else window.DOMUtils.lockBodyScroll(true);

    debugLog('[BAN SYSTEM] Modal abierto correctamente');
  }

  async function handleConfirmBan() {
    if (handleConfirmBan.isSubmitting) return;
    handleConfirmBan.isSubmitting = true;
    const confirmBtn = document.getElementById('confirmBanBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    const userId = document.getElementById('banTargetUserId').value;
    const reasonCode = document.getElementById('banReasonSelect').value;
    const duration = document.getElementById('banDurationSelect').value;
    const details = document.getElementById('banReasonDetails').value;

    if (!reasonCode) {
      alert('Selecciona un motivo');
      if (confirmBtn) confirmBtn.disabled = false;
      handleConfirmBan.isSubmitting = false;
      return;
    }
    if (details.length < 10) {
      alert('Detalles muy cortos (mín. 10)');
      if (confirmBtn) confirmBtn.disabled = false;
      handleConfirmBan.isSubmitting = false;
      return;
    }

    let banCompleted = false;
    try {
      await banUser(userId, reasonCode, details, duration);
      banCompleted = true;
    } catch (e) {
      alert('Error al banear: ' + e.message);
    } finally {
      if (banCompleted) {
        try {
          closeBanReasonModal();
        } catch (_closeErr) {
          const modal = document.getElementById('banReasonModal');
          if (modal) {
            window.DOMUtils.setDisplay(modal, 'none');
            modal.classList.add('modal-hidden');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
          }
        }
      }
      if (confirmBtn) confirmBtn.disabled = false;
      handleConfirmBan.isSubmitting = false;
    }
  }

  function initEventListeners() {
    const modal = document.getElementById('banReasonModal');
    const cancelBtn = document.getElementById('cancelBanBtn');
    const confirmBtn = document.getElementById('confirmBanBtn');
    const closeBtn = modal?.querySelector('.modal-close-top, [data-action="closeBanReasonModal"]');

    if (cancelBtn && !cancelBtn.dataset.banBound) {
      cancelBtn.dataset.banBound = '1';
      cancelBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeBanReasonModal();
      });
    }

    if (confirmBtn && !confirmBtn.dataset.banBound) {
      confirmBtn.dataset.banBound = '1';
      confirmBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        if (confirmBtn.dataset.confirmArmed !== '1') {
          setConfirmButtonState(true);
          return;
        }
        await handleConfirmBan();
      });
    }

    if (closeBtn && !closeBtn.dataset.banBound) {
      closeBtn.dataset.banBound = '1';
      closeBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeBanReasonModal();
      });
    }

    const registerBanDelegationHandlers = () => {
      const delegation = window.EventDelegation;
      if (!delegation || typeof delegation.registerHandler !== 'function') {
        return false;
      }

      delegation.registerHandler('ban-user', (element, event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const uid = element?.dataset?.userId;
        const email = element?.dataset?.userEmail;
        if (!uid || !email) return;
        debugLog('[BAN SYSTEM] Abriendo modal de baneo para:', email);
        showBanModal(uid, email);
      });

      delegation.registerHandler('unban-user', async (element, event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const uid = element?.dataset?.userId;
        if (!uid) return;
        await unbanUser(uid);
      });
      return true;
    };

    registerBanDelegationHandlers();

    // Delegación global: solo para acciones de tabla de usuarios.
    if (!document.documentElement.dataset.banSystemDelegationBound) {
      document.documentElement.dataset.banSystemDelegationBound = '1';
      document.addEventListener(
        'click',
        async e => {
          const actionBtn = e.target.closest(
            '[data-action="ban-user"], [data-action="unban-user"]'
          );
          if (!actionBtn) {
            return;
          }
          const action = actionBtn.dataset.action;
          const uid = actionBtn.dataset.userId;
          const email = actionBtn.dataset.userEmail;
          const hasDelegatedHandler = !!window.EventDelegation?.handlers?.has?.(action);

          if (hasDelegatedHandler) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          if (action === 'ban-user') {
            debugLog('[BAN SYSTEM] Abriendo modal de baneo para:', email);
            showBanModal(uid, email);
          } else if (action === 'unban-user') {
            await unbanUser(uid);
          }
        },
        true
      );
    }

    // Listener para cerrar al hacer clic fuera del modal
    if (modal && !modal.dataset.dismissBound) {
      modal.dataset.dismissBound = '1';
      modal.addEventListener('cancel', e => {
        e.preventDefault();
        closeBanReasonModal();
      });
      modal.addEventListener('click', e => {
        const content = modal.querySelector('.modal-content');
        if (!content || !content.contains(e.target)) {
          debugLog('[BAN SYSTEM] Cerrando modal (click fuera)');
          closeBanReasonModal();
        }
      });
    }
  }

  // Exportar API Global
  window.BanSystem = {
    checkBanStatus: checkUserBanStatus,
    banUser: banUser,
    unbanUser: unbanUser,
    showBanModal: showBanModal,
    showBannedModal: showBannedModal,
    closeBanReasonModal: closeBanReasonModal,
    emergencyUnbanAdmin: emergencyUnbanAdmin, // Función de emergencia
    emergencyClearIPBans: emergencyClearIPBans, // Función de emergencia
  };

  // Alias globales para compatibilidad con users-manager.js
  window.showBanModal = showBanModal;
  window.unbanUser = unbanUser;

  // Inicialización CONDICIONAL
  // CRITICAL: Solo inicializar si NO estamos en la página de inicio
  const initConditionalGuard = () => {
    if (!document.body) {
      console.warn('[BAN SYSTEM] document.body aún no está disponible');
      return;
    }
    const currentView = document.body.getAttribute('data-current-view');
    if (currentView !== 'homeView') {
      debugLog('[BAN SYSTEM] Inicializando guard (no estamos en homeView)');
      initLoginGuard();
    } else {
      debugLog('[BAN SYSTEM] ⏸️ Omitiendo inicialización en homeView');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConditionalGuard);
  } else {
    initConditionalGuard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventListeners);
  } else {
    initEventListeners();
  }

  debugLog('[BAN SYSTEM] ✅ Sistema de baneo inicializado correctamente');
}

export function initBanSystem() {
  if (window.__BAN_SYSTEM_INITED__) {
    return;
  }

  window.__BAN_SYSTEM_INITED__ = true;
  setupBanSystem();
}

if (typeof window !== 'undefined' && !window.__BAN_SYSTEM_NO_AUTO__) {
  initBanSystem();
}
