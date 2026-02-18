/**
 * Auth JS - Manejo de autenticación con Firebase
 * Migrated to use AppState for centralized state management
 * @version 2.0.0 - Window Exposure Pattern
 */

/* global firebase, lucide */

// Validate AppState is available
if (!globalThis.AppState) {
    const error = new Error(
        '[auth.js] Failed to load: globalThis.AppState is not defined. ' +
        'Ensure app-state.js loads before auth.js.'
    );
    console.error(error);
    throw error;
}

// Record load time for validation (dev only)
if (globalThis.LoadOrderValidator) {
    globalThis.LoadOrderValidator.recordScriptLoad('auth.js');
}

(function() {
    'use strict';

    // Guard global: evita doble inicialización del módulo (listeners duplicados).
    if (globalThis.__AUTH_JS_MODULE_INITED__) {
        Logger.warn('auth.js already initialized, skipping duplicate init', 'AUTH');
        return;
    }
    globalThis.__AUTH_JS_MODULE_INITED__ = true;

    // Use AppState from window
    const AppState = globalThis.AppState;

    Logger.info('Inicializando módulo de autenticación...', 'AUTH');

    let isInitialized = false;
    let observerInitialized = false;
    let listenersInitialized = false;
    const adminOnlyModals = new Set([
        'userFormModal',
        'deleteUserModal',
        'banReasonModal',
        'bannedUserModal',
        'deleteAnnouncementModal',
    ]);

    const clearDisallowedModal = viewId => {
        if (!AppState || typeof AppState.getState !== 'function') return;
        const activeModal = AppState.getState('modal.active');
        if (!activeModal) return;
        const isAdminView = viewId === 'adminView';
        if (!isAdminView && adminOnlyModals.has(activeModal)) {
            AppState.setState('modal.active', null, true);
            AppState.setState('modal.data', null, true);
            try {
                localStorage.removeItem('modal.active');
                localStorage.removeItem('modal.data');
            } catch (_e) {}
            Logger.debug(
                `Modal admin bloqueado en vista pública: ${activeModal}`,
                'AUTH'
            );
        }
    };

    const syncViewState = viewId => {
        clearDisallowedModal(viewId);
        if (document.body) {
            document.body.dataset.currentView = viewId;
        }
        try {
            localStorage.setItem('currentView', viewId);
        } catch (_e) {}
        if (AppState && typeof AppState.setState === 'function') {
            AppState.setState('view.current', viewId);
        }
    };

    const updateLoginButton = user => {
        const loginBtn = document.getElementById('loginBtn');
        if (!loginBtn) return;

        if (user) {
            const displayName =
                user.displayName || user.email || user.name || 'Usuario';
            loginBtn.innerHTML = `<i data-lucide="user-check" aria-hidden="true" class="login-icon-accent"></i> <span>${displayName}</span>`;
            loginBtn.dataset.action = 'logout';
            Logger.debug(`Login button updated with user: ${displayName}`, 'AUTH');
        } else {
            loginBtn.innerHTML =
                '<i data-lucide="user" aria-hidden="true"></i> <span data-translate="login">Login</span>';
            loginBtn.dataset.action = 'showLoginView';
            Logger.debug('Login button reset', 'AUTH');
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    };

    const restoreHeaderFooter = contextLabel => {
        const header = document.querySelector('.main-header');
        const footer = document.querySelector('.modern-footer');
        if (header) {
            window.DOMUtils.setDisplay(header, '');
            Logger.debug(
                `Header restored${contextLabel ? ` (${contextLabel})` : ''}`,
                'AUTH'
            );
        }
        if (footer) {
            window.DOMUtils.setDisplay(footer, '');
            Logger.debug(
                `Footer restored${contextLabel ? ` (${contextLabel})` : ''}`,
                'AUTH'
            );
        }
    };

    const showHomeViewSafe = () => {
        if (typeof window.showHomeView === 'function') {
            window.showHomeView();
            syncViewState('homeView');
            Logger.debug('Navigated to home view (showHomeView)', 'AUTH');
            return;
        }

        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
            window.DOMUtils.setDisplay(view, 'none');
            view.setAttribute('aria-hidden', 'true');
        });

        const homeView = document.getElementById('homeView');
        if (homeView) {
            homeView.classList.add('active');
            window.DOMUtils.setDisplay(homeView, 'block');
            homeView.setAttribute('aria-hidden', 'false');
            syncViewState('homeView');
            Logger.debug('Navigated to home view (fallback)', 'AUTH');
        } else {
            Logger.error('Home view not found', 'AUTH');
        }
    };

    const ensureLocalPersistence = async () => {
        try {
            const authInstance = firebase && firebase.auth && firebase.auth();
            if (
                authInstance &&
                typeof authInstance.setPersistence === 'function' &&
                firebase.auth.Auth &&
                firebase.auth.Auth.Persistence &&
                firebase.auth.Auth.Persistence.LOCAL
            ) {
                await authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                Logger.debug('Auth persistence set to LOCAL', 'AUTH');
            }
        } catch (error) {
            Logger.warn('Could not set auth persistence to LOCAL', 'AUTH', error);
        }
    };

    const shouldFallbackCallable = error => {
        const code = String(error?.code || '').toLowerCase();
        const msg = String(error?.message || '').toLowerCase();
        return (
            code.includes('not-found') ||
            code.includes('unimplemented') ||
            msg.includes('not found') ||
            msg.includes('does not exist')
        );
    };

    const checkIPBeforeRegistration = async (email, options = {}) => {
        const trackBlocked = reason => {
            try {
                if (typeof globalThis.gtag === 'function') {
                    globalThis.gtag('event', 'registration_blocked', {
                        reason: String(reason || 'unknown'),
                    });
                }
            } catch (_e) {}
        };

        try {
            const callableNames = ['preRegisterGuardV2', 'preRegisterGuard'];
            let lastError = null;
            for (let i = 0; i < callableNames.length; i += 1) {
                const fnName = callableNames[i];
                try {
                    const callable = firebase.functions().httpsCallable(fnName);
                    const result = await callable({
                        email,
                        website: options.website || '',
                        userAgent: options.userAgent || '',
                    });
                    return !!result?.data?.allowed;
                } catch (error) {
                    lastError = error;
                    if (i === callableNames.length - 1 || !shouldFallbackCallable(error)) {
                        break;
                    }
                }
            }

            const code = String(lastError?.code || '').toLowerCase();
            const reason = String(lastError?.details?.reason || '');
            trackBlocked(reason || code || 'unknown');
            if (code.includes('resource-exhausted')) {
                notify('Demasiados intentos. Intenta de nuevo en 1 minuto.', 'warning');
                return false;
            }
            if (code.includes('invalid-argument')) {
                notify(
                    reason === 'invalid_email'
                        ? 'Email inválido.'
                        : 'Email no permitido para registro.',
                    'warning'
                );
                return false;
            }
            if (code.includes('permission-denied')) {
                notify('Registro bloqueado por seguridad.', 'warning');
                return false;
            }

            Logger.warn('Guard de registro no disponible', 'AUTH', lastError);
            notify(
                'No se pudo validar el registro ahora. Intenta de nuevo en unos segundos.',
                'warning'
            );
            return false;
        } catch (error) {
            Logger.warn('Error en guard de registro', 'AUTH', error);
            notify(
                'No se pudo validar el registro ahora. Intenta de nuevo en unos segundos.',
                'warning'
            );
            return false;
        }
    };

    globalThis.checkIPBeforeRegistration = checkIPBeforeRegistration;

    const debugAdminResolution = async (user, stage = 'unknown') => {
        if (!user) return;
        try {
            const tokenResult = await user.getIdTokenResult(false);
            const claims = tokenResult && tokenResult.claims ? tokenResult.claims : {};

            let userRole = null;
            try {
                const userDoc = await firebase
                    .firestore()
                    .collection('users')
                    .doc(user.uid)
                    .get();
                userRole = userDoc.exists && userDoc.data() ? userDoc.data().role || null : null;
            } catch (_e) {}

            let allowEmailMatch = false;
            let allowUidMatch = false;
            try {
                const settingsDoc = await firebase
                    .firestore()
                    .collection('settings')
                    .doc('system-config')
                    .get();
                if (settingsDoc.exists) {
                    const security = (settingsDoc.data() && settingsDoc.data().security) || {};
                    const allowEmails = String(security.adminAllowlistEmails || '')
                        .split(',')
                        .map(v => v.trim().toLowerCase())
                        .filter(Boolean);
                    const allowUids = String(security.adminAllowlistUids || '')
                        .split(',')
                        .map(v => v.trim())
                        .filter(Boolean);
                    allowEmailMatch = !!(user.email && allowEmails.includes(user.email.toLowerCase()));
                    allowUidMatch = !!(user.uid && allowUids.includes(user.uid));
                }
            } catch (_e) {}

            const isAdminResolved = await resolveAdminStatus(user);
            Logger.debug('[AUTH DEBUG]', 'AUTH', {
                stage,
                uid: user.uid,
                email: user.email || null,
                claimsAdmin: claims.admin === true,
                claimsRole: claims.role || null,
                usersRole: userRole,
                allowEmailMatch,
                allowUidMatch,
                isAdminResolved,
            });
        } catch (e) {
            console.warn('[AUTH DEBUG] failed', stage, e);
        }
    };

    const resolveAdminStatus = async user => {
        if (!user) return false;

        const emailLower = (user.email || '').toLowerCase();
        const uid = user.uid || '';

        // 1) Primero: Verificar claims existentes en el token (fuente de verdad más rápida)
        try {
            const tokenResult = await user.getIdTokenResult(false);
            const claims = tokenResult ? tokenResult.claims : null;
            if (
                claims &&
                (claims.admin === true ||
                    claims.role === 'admin' ||
                    claims.role === 'super_admin')
            ) {
                Logger.debug('Admin status confirmed via existing claims', 'AUTH');
                return true;
            }
        } catch (error) {
            Logger.debug('Token result check failed (non-critical)', 'AUTH');
        }

        // 1b) Claims forzados (refresh) para evitar token stale tras cambio de permisos
        try {
            const refreshedClaims = window.getAdminClaims
                ? await window.getAdminClaims(user, true)
                : (await user.getIdTokenResult(true)).claims;
            if (
                refreshedClaims &&
                (refreshedClaims.admin === true ||
                    refreshedClaims.role === 'admin' ||
                    refreshedClaims.role === 'super_admin')
            ) {
                Logger.debug('Admin status confirmed via refreshed claims', 'AUTH');
                return true;
            }
        } catch (error) {
            Logger.debug('Forced claims refresh failed (non-critical)', 'AUTH');
        }

        // 2) Segundo: Verificar rol en la colección 'users' (el usuario puede leer su propio doc)
        try {
            const userDoc = await firebase
                .firestore()
                .collection('users')
                .doc(uid)
                .get();
            if (userDoc.exists && userDoc.data() && userDoc.data().role === 'admin') {
                Logger.debug('Admin status confirmed via Firestore users collection', 'AUTH');
                return true;
            }
        } catch (error) {
            Logger.debug('Firestore user doc check failed (non-critical)', 'AUTH', error);
        }

        // 3) Tercero: Intento directo al allowlist (puede fallar por permisos)
        try {
            const settingsDoc = await firebase
                .firestore()
                .collection('settings')
                .doc('system-config')
                .get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                const security = (data && data.security) || {};
                const allowEmails = String(security.adminAllowlistEmails || '')
                    .split(',')
                    .map(v => v.trim().toLowerCase())
                    .filter(Boolean);
                const allowUids = String(security.adminAllowlistUids || '')
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean);
                if (
                    (emailLower && allowEmails.includes(emailLower)) ||
                    (uid && allowUids.includes(uid))
                ) {
                    Logger.info('Admin status identified via allowlist', 'AUTH');
                    return true;
                }
            }
        } catch (error) {
            // Usar debug en lugar de warn/error para evitar ruido en consola del usuario
            Logger.debug('Admin settings allowlist check failed (expected for non-admins)', 'AUTH');
        }

        // 4) Cuarto: Central service check (fallback)
        try {
            const service = window.AdminClaimsService;
            if (service && service.isAdmin) {
                let allowlist = null;
                const settingsService = window.AdminSettingsService;
                if (settingsService && settingsService.getAllowlist) {
                    try {
                        allowlist = await settingsService.getAllowlist({
                            allowDefault: false,
                        });
                    } catch (e) {
                        Logger.debug('Could not get allowlist from service', 'AUTH');
                    }
                }
                const serviceAdmin = await service.isAdmin(user, allowlist);
                if (serviceAdmin) return true;
            }
        } catch (error) {
            Logger.debug('Admin service check fallback failed', 'AUTH');
        }

        return false;
    };


    let loginTemplateWaiting = false;
    const waitForLoginTemplateAndRetry = () => {
        if (loginTemplateWaiting) return;
        loginTemplateWaiting = true;
        const onTemplateLoaded = () => {
            loginTemplateWaiting = false;
            Logger.debug('loginView template loaded, retrying auth listeners...', 'AUTH');
            setTimeout(() => setupAuthListeners(0), 0);
        };
        window.addEventListener('loginView:templateLoaded', onTemplateLoaded, {
            once: true
        });
    };

    const setupAuthListeners = (attempt = 0) => {
        // Referencias a formularios
        const loginForm = document.getElementById('loginFormElement');
        const registerForm = document.getElementById('registerFormElement');
        const resetForm = document.getElementById('resetFormElement');

        // Referencias a botones sociales
        const googleLoginBtns = document.querySelectorAll(
            '.google-btn-new, [data-action="loginWithGoogle"]'
        );
        const googleRegisterBtns = document.querySelectorAll(
            '[data-action="registerWithGoogle"]'
        );
        const recaptchaSiteKey =
            (window.RUNTIME_CONFIG &&
                window.RUNTIME_CONFIG.recaptcha &&
                window.RUNTIME_CONFIG.recaptcha.siteKey) ||
            '';
        if (recaptchaSiteKey) {
            document
                .querySelectorAll(
                    '.g-recaptcha[data-callback="onRecaptchaRegisterSuccess"]'
                )
                .forEach(btn => {
                    btn.setAttribute('data-sitekey', recaptchaSiteKey);
                });
        }

        // Si no se encuentran los elementos principales, reintentar.
        if (!loginForm || !registerForm || !resetForm) {
            if (attempt < 10) {
                Logger.debug(`Esperando elementos del DOM (intento ${attempt + 1})...`, 'AUTH');
                setTimeout(() => setupAuthListeners(attempt + 1), 500);
                return;
            }
            Logger.warn('Auth forms not found after retries. Waiting for login template...', 'AUTH');
            waitForLoginTemplateAndRetry();
            return;
        }

        if (listenersInitialized) return;
        listenersInitialized = true;

        Logger.debug('Configurando listeners de autenticación...', 'AUTH');

        // CONFIGURACIÓN GLOBAL
        firebase.auth().useDeviceLanguage();

        // 0. Manejar Resultado de Redirect (Fallback)
        firebase
            .auth()
            .getRedirectResult()
            .then(result => {
                if (result && result.user) {
                    Logger.info('Login via Redirect successful', 'AUTH');

                    // Navegar a home view
                    setTimeout(() => {
                        const loginView = document.getElementById('loginView');
                        if (loginView) {
                            loginView.classList.remove('active');
                            loginView.classList.add('hidden');
                            window.DOMUtils.setDisplay(loginView, 'none');
                        }

                        const homeView = document.getElementById('homeView');
                        if (homeView) {
                            homeView.classList.add('active');
                            window.DOMUtils.setDisplay(homeView, 'block');
                            syncViewState('homeView');
                        }

                        restoreHeaderFooter('redirect');
                    }, 500);
                }
            })
            .catch(error => {
                Logger.error('Redirect Auth Error', 'AUTH', error);
                handleAuthError(error);
            });

        // Limpiar formulario de login cuando se abre la vista
        document.addEventListener('click', e => {
            if (
                e.target.matches('[data-action="showLoginView"]') ||
                e.target.closest('[data-action="showLoginView"]')
            ) {
                // Limpiar campos de login después de un pequeño delay
                setTimeout(() => {
                    if (loginForm) {
                        loginForm.reset();
                        // Forzar limpieza de autocompletado del navegador
                        const emailInput = document.getElementById('loginEmail');
                        const passwordInput = document.getElementById('loginPassword');
                        if (emailInput) {
                            emailInput.value = '';
                            emailInput.setAttribute('value', '');
                        }
                        if (passwordInput) {
                            passwordInput.value = '';
                            passwordInput.setAttribute('value', '');
                        }
                        Logger.debug('Formulario de login limpiado', 'AUTH');
                    }
                }, 100);
            }
        });

        // Helper para notificaciones
        const notify = (msg, type = 'info') => {
            if (globalThis.NotificationSystem) {
                globalThis.NotificationSystem[type](msg);
            } else {
                alert(msg);
            }
        };

        let mfaResolver = null;
        let mfaVerificationId = null;

        const ensureMfaLoginModal = () => {
            let modal = document.getElementById('mfaLoginModal');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'mfaLoginModal';
            modal.className = 'mfa-login-modal-overlay';
            modal.setAttribute('aria-hidden', 'true');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'mfaLoginTitle');

            modal.innerHTML = `
        <div class="mfa-login-modal" role="document">
          <div class="mfa-login-modal__header">
            <h2 id="mfaLoginTitle" class="mfa-login-modal__title">Verificación en dos pasos</h2>
            <button type="button" class="mfa-login-modal__close modal-close" aria-label="Cerrar">×</button>
          </div>
          <div class="mfa-login-modal__body">
            <p class="mfa-login-modal__message">
              Se requiere un código SMS para completar el inicio de sesión.
            </p>
            <div class="mfa-login-modal__group">
              <label for="mfaLoginCode">Código SMS</label>
              <input id="mfaLoginCode" class="mfa-login-modal__input" inputmode="numeric" maxlength="6" placeholder="Ingresa el código"/>
              <button type="button" class="modal-btn secondary" data-action="mfaSendCode">Reenviar código</button>
            </div>
            <div id="mfaLoginRecaptcha" class="mfa-login-modal__recaptcha"></div>
            <div id="mfaLoginStatus" class="mfa-login-modal__status" role="status"></div>
          </div>
          <div class="mfa-login-modal__actions">
            <button type="button" class="modal-btn secondary" data-action="mfaCancel">Cancelar</button>
            <button type="button" class="modal-btn primary" data-action="mfaVerify">Verificar</button>
          </div>
        </div>
      `;

            document.body.appendChild(modal);
            return modal;
        };

        const setMfaStatus = (modal, message, isError = false) => {
            const status = modal.querySelector('#mfaLoginStatus');
            if (!status) return;
            status.textContent = message;
            status.classList.toggle('is-error', Boolean(isError));
        };

        const ensureMfaRecaptcha = modal => {
            if (modal.__mfaRecaptchaVerifier) {
                return modal.__mfaRecaptchaVerifier;
            }
            const container = modal.querySelector('#mfaLoginRecaptcha');
            if (!container) {
                throw new Error('Contenedor reCAPTCHA no disponible');
            }
            container.innerHTML = '';
            const verifier = new firebase.auth.RecaptchaVerifier(container, {
                size: 'invisible',
            });
            modal.__mfaRecaptchaVerifier = verifier;
            return verifier;
        };

        const closeMfaLoginModal = () => {
            const modal = document.getElementById('mfaLoginModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            setMfaStatus(modal, '');
            mfaResolver = null;
            mfaVerificationId = null;
        };

        const openMfaLoginModal = resolver => {
            const modal = ensureMfaLoginModal();
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            setMfaStatus(modal, '');
            mfaResolver = resolver;
            mfaVerificationId = null;
        };

        const sendMfaLoginCode = async () => {
            if (!mfaResolver) {
                throw new Error('No hay sesión MFA activa');
            }
            const modal = ensureMfaLoginModal();
            const sendBtn = modal.querySelector('[data-action="mfaSendCode"]');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Enviando...';
            }
            setMfaStatus(modal, 'Enviando código SMS...');

            try {
                const hint = mfaResolver.hints[0];
                const verifier = ensureMfaRecaptcha(modal);
                const provider = new firebase.auth.PhoneAuthProvider();
                const verificationId = await provider.verifyPhoneNumber({
                        multiFactorHint: hint,
                        session: mfaResolver.session
                    },
                    verifier
                );
                mfaVerificationId = verificationId;
                setMfaStatus(modal, 'Código enviado. Revisa tu SMS.');
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Reenviar código';
                }
            }
        };

        const verifyMfaLoginCode = async () => {
            const modal = ensureMfaLoginModal();
            const verifyBtn = modal.querySelector('[data-action="mfaVerify"]');
            const codeInput = modal.querySelector('#mfaLoginCode');
            const code = codeInput ? codeInput.value.trim() : '';

            if (!mfaVerificationId) {
                setMfaStatus(modal, 'Primero solicita el código SMS.', true);
                return;
            }
            if (!code) {
                setMfaStatus(modal, 'Ingresa el código recibido.', true);
                return;
            }

            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verificando...';
            }

            try {
                const credential = firebase.auth.PhoneAuthProvider.credential(
                    mfaVerificationId,
                    code
                );
                const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(
                    credential
                );
                const result = await mfaResolver.resolveSignIn(assertion);
                closeMfaLoginModal();
                return result;
            } finally {
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verificar';
                }
            }
        };

    const handleLoginSuccess = async userCredential => {
            // Actualizar ubicación del usuario (IP y país) en background
            try {
                const updateLocation = firebase
                    .functions()
                    .httpsCallable('updateUserLocation');
                updateLocation()
                    .then(() => Logger.debug('User location updated', 'AUTH'))
                    .catch(locationError => {
                        Logger.warn('Could not update user location', 'AUTH', locationError);
                    });
            } catch (locationError) {
                Logger.warn('Could not update user location', 'AUTH', locationError);
            }

      // Email no verificado: avisar, pero no bloquear sesión.
      if (!userCredential.user.emailVerified) {
        Logger.warn(`Email no verificado: ${userCredential.user.email}`, 'AUTH');
        notify(
          'Email no verificado: acceso permitido. Recomendamos verificar tu correo.',
          'warning'
        );
      }

      // Verificación de baneo NO bloqueante para evitar falsos negativos de login.
      if (globalThis.BanSystem && globalThis.BanSystem.checkBanStatus) {
        setTimeout(async () => {
          try {
            const banStatus = await globalThis.BanSystem.checkBanStatus(
              userCredential.user.uid
            );
            if (banStatus && banStatus.banned) {
              Logger.warn('Usuario baneado detectado (background)', 'AUTH', banStatus);
              if (globalThis.BanSystem && globalThis.BanSystem.showBannedModal) {
                globalThis.BanSystem.showBannedModal(banStatus);
              } else {
                alert('ACCESO DENEGADO: Cuenta suspendida.');
              }
              await firebase.auth().signOut();
            }
          } catch (banError) {
            Logger.warn('Ban check background failed', 'AUTH', banError);
          }
        }, 0);
      }

            // Sincronizar estado admin/role inmediatamente tras login email-password
            try {
                const isAdminAtLogin = await resolveAdminStatus(userCredential.user);
                const current = AppState.getState('user') || {};
                AppState.setState('user', {
                    ...current,
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName:
                        userCredential.user.displayName ||
                        userCredential.user.email ||
                        'Usuario',
                    photoURL: userCredential.user.photoURL || null,
                    isAuthenticated: true,
                    isAdmin: isAdminAtLogin,
                    role: isAdminAtLogin ? 'admin' : 'client',
                });

                const adminBtns = document.querySelectorAll('.header-admin-btn');
                adminBtns.forEach(adminBtn => {
                    if (isAdminAtLogin) {
                        adminBtn.removeAttribute('hidden');
                    } else {
                        adminBtn.setAttribute('hidden', '');
                    }
                });

                if (isAdminAtLogin) {
                    localStorage.setItem('isAdmin', 'true');
                } else {
                    localStorage.removeItem('isAdmin');
                }
            } catch (adminSyncError) {
                Logger.warn(
                    'Could not sync admin state immediately after email login',
                    'AUTH',
                    adminSyncError
                );
            }

            updateLoginButton(userCredential.user);
            showHomeViewSafe();
            restoreHeaderFooter();
            dismissAuthLoadingOverlay();
            return true;
        };

        const withTimeout = (promise, ms, label) =>
            Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`${label} timeout`)), ms)
                ),
            ]);

        const dismissAuthLoadingOverlay = () => {
            const overlay =
                document.getElementById('loadingScreen') ||
                document.getElementById('auth-loading-overlay');
            if (!overlay) return;

            document.body.classList.add('app-loaded');
            overlay.classList.add('fade-out', 'pointer-events-none');
            setTimeout(() => {
                window.DOMUtils.setDisplay(overlay, 'none');
            }, 300);
        };

        // Helper para mostrar errores de Firebase
        const handleAuthError = error => {
            Logger.error('Auth Error', 'AUTH', error);
            let message = 'Error de autenticación: ' + error.message;

            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'No existe una cuenta con este correo electrónico.';
                    break;
                case 'auth/wrong-password':
                    message = 'Contraseña incorrecta.';
                    break;
                case 'auth/email-already-in-use':
                    message = 'Este correo ya está registrado.';
                    break;
                case 'auth/weak-password':
                    message =
                        'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
                    break;
                case 'auth/invalid-email':
                    message = 'El formato del correo electrónico no es válido.';
                    break;
                case 'auth/popup-closed-by-user':
                    message = 'Se cerró la ventana de inicio de sesión.';
                    break;
                case 'auth/too-many-requests':
                    message =
                        'Demasiados intentos fallidos. Por favor intenta más tarde.';
                    break;
                case 'auth/invalid-credential':
                case 'auth/invalid-login-credentials':
                    message = 'Email o contraseña incorrectos.';
                    break;
            }

            notify(message, 'error');
        };

        const handleMfaLogin = async error => {
            try {
                if (!error || error.code !== 'auth/multi-factor-auth-required') {
                    return false;
                }
                const resolver = error.resolver;
                if (!resolver) {
                    throw new Error('No se pudo iniciar el flujo MFA');
                }
                openMfaLoginModal(resolver);

                const modal = ensureMfaLoginModal();
                const sendBtn = modal.querySelector('[data-action="mfaSendCode"]');
                const verifyBtn = modal.querySelector('[data-action="mfaVerify"]');
                const cancelBtn = modal.querySelector('[data-action="mfaCancel"]');
                const closeBtn = modal.querySelector('.mfa-login-modal__close');

                if (sendBtn && !sendBtn.dataset.listener) {
                    sendBtn.dataset.listener = '1';
                    sendBtn.addEventListener('click', () =>
                        sendMfaLoginCode().catch(err => {
                            console.error('[MFA] Error sending code', err);
                            setMfaStatus(modal, err.message, true);
                        })
                    );
                }

                if (verifyBtn && !verifyBtn.dataset.listener) {
                    verifyBtn.dataset.listener = '1';
                    verifyBtn.addEventListener('click', async () => {
                        try {
                            const result = await verifyMfaLoginCode();
                            if (result) {
                                await handleLoginSuccess(result);
                            }
                        } catch (err) {
                            console.error('[MFA] Error verifying code', err);
                            setMfaStatus(modal, err.message, true);
                        }
                    });
                }

                if (cancelBtn && !cancelBtn.dataset.listener) {
                    cancelBtn.dataset.listener = '1';
                    cancelBtn.addEventListener('click', closeMfaLoginModal);
                }

                if (closeBtn && !closeBtn.dataset.listener) {
                    closeBtn.dataset.listener = '1';
                    closeBtn.addEventListener('click', closeMfaLoginModal);
                }

                await sendMfaLoginCode();
                return true;
            } catch (err) {
                console.error('[MFA] Error handling MFA login', err);
                notify(err.message || 'Error al procesar MFA', 'error');
                return true;
            }
        };

        const diagnoseCredentialError = async email => {
            try {
                const authInstance = firebase && firebase.auth ? firebase.auth() : null;
                if (!authInstance || typeof authInstance.fetchSignInMethodsForEmail !== 'function') {
                    return false;
                }
                const methods = await authInstance.fetchSignInMethodsForEmail(email);
                if (Array.isArray(methods) && methods.includes('google.com') && !methods.includes('password')) {
                    notify(
                        'Esta cuenta está configurada para Google. Usa "Continuar con Google" o restablece contraseña.',
                        'warning'
                    );
                    return true;
                }
                return false;
            } catch (_e) {
                return false;
            }
        };

        const offerPasswordResetOnInvalidCredential = async email => {
            try {
                const wantsReset = confirm(
                    'No se pudo iniciar sesión con esas credenciales. ¿Quieres enviar un enlace para restablecer la contraseña?'
                );
                if (!wantsReset) return false;
                await firebase.auth().sendPasswordResetEmail(email);
                notify(
                    'Si el correo existe, se ha enviado un enlace para restablecer la contraseña.',
                    'success'
                );
                return true;
            } catch (resetError) {
                Logger.warn('Password reset from login failed', 'AUTH', resetError);
                return false;
            }
        };

        const isLocalDevHost = () =>
            window.location &&
            (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1');

        const isApiKeyReferrerBlocked = error => {
            const text = `${error?.message || ''} ${error?.customData?._serverResponse || ''}`
                .toLowerCase()
                .trim();
            return (
                text.includes('api_key_http_referrer_blocked') ||
                (text.includes('referer') && text.includes('blocked'))
            );
        };

        const notifyApiKeyReferrerFix = () => {
            const authDomain =
                window.RUNTIME_CONFIG?.firebase?.authDomain ||
                'white-caster-466401-g0.firebaseapp.com';
            notify(
                `API key bloqueada por referrer. Permite: 127.0.0.1:5173, localhost:5173, ${authDomain}, white-caster-466401-g0.web.app`,
                'error'
            );
        };

        const ensureAppCheckForAuth = async () => {
            try {
                if (typeof window.getAppCheckStatus !== 'function') return true;
                const status = window.getAppCheckStatus() || {};

                if (status.disabled) {
                    Logger.warn(
                        `App Check disabled before auth: ${status.reason || 'unknown'}`,
                        'AUTH'
                    );
                    if (isLocalDevHost()) {
                        if (
                            String(status.reason || '').includes(
                                'localhost app-check disabled by default'
                            )
                        ) {
                            notify(
                                'Login bloqueado en local: Auth requiere App Check. Activa localStorage wifihackx:appcheck:enabled=1 y usa debug token válido, o pon Authentication en Monitor.',
                                'warning'
                            );
                            return false;
                        }
                        notify(
                            'App Check local desactivado o no listo. Si quieres activarlo: localStorage wifihackx:appcheck:enabled=1',
                            'warning'
                        );
                        return false;
                    }
                    return false;
                }

                if (typeof window.waitForAppCheck === 'function') {
                    await window.waitForAppCheck(9000);
                }

                return true;
            } catch (error) {
                Logger.warn('App Check not ready for auth flow', 'AUTH', error);
                notify('App Check no está listo. Recarga e inténtalo de nuevo.', 'warning');
                return false;
            }
        };

        const handleAuthInfraError = error => {
            const errCode = String(error?.code || '').toLowerCase();
            if (isApiKeyReferrerBlocked(error)) {
                notifyApiKeyReferrerFix();
                return true;
            }
            if (errCode === 'auth/firebase-app-check-token-is-invalid') {
                notify(
                    'Token App Check inválido. Verifica token debug registrado en Firebase App Check.',
                    'error'
                );
                return true;
            }
            if (errCode === 'auth/network-request-failed' && isLocalDevHost()) {
                notify(
                    'Fallo de red/Auth en local. Revisa App Check debug token y restricciones de API key.',
                    'warning'
                );
                return true;
            }
            return false;
        };

        // Guard para evitar submit duplicado en email/password.
        let emailAuthInProgress = false;

        // 1. Manejo de Login
        if (loginForm) {
            if (loginForm.dataset.authSubmitBound !== '1') {
                loginForm.dataset.authSubmitBound = '1';
                loginForm.addEventListener('submit', async e => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    Logger.debug('Login form submission intercepted', 'AUTH');

                    if (emailAuthInProgress) {
                        Logger.warn('Email auth already in progress, ignoring duplicated submit', 'AUTH');
                        return;
                    }

                    // 1) Evitar cruce de flujos
                    if (googleAuthInProgress) {
                        Logger.warn('Skipping email submit while Google auth is in progress', 'AUTH');
                        // Timeout safety
                        if (globalThis._googleAuthStartTime && Date.now() - globalThis._googleAuthStartTime > 30000) {
                            Logger.warn('Google auth reset after 30s timeout', 'AUTH');
                            googleAuthInProgress = false;
                        } else {
                            return;
                        }
                    }

                    // 2) Detectar si el submit vino de un botón de Google (usando event delegation o submitter)
                    const submitter = e && e.submitter;
                    const target = e && e.target;

                    if (
                        (submitter && submitter.dataset && (submitter.dataset.action === 'loginWithGoogle' || submitter.dataset.action === 'registerWithGoogle')) ||
                        (target && target.closest('[data-action="loginWithGoogle"], [data-action="registerWithGoogle"]'))
                    ) {
                        Logger.debug('Skipping email submit triggered by Google action', 'AUTH');
                        return;
                    }

                    // 3) Verificar visibilidad del panel (más flexible)
                    const loginTabPanel = document.getElementById('loginForm');
                    const loginTabActive = loginTabPanel ?
                        (!loginTabPanel.hasAttribute('hidden') && loginTabPanel.getAttribute('aria-hidden') !== 'true') :
                        true;

                    if (!loginTabActive) {
                        Logger.debug('Login form panel is not active/visible, checking if forced...', 'AUTH');
                        // Force if specifically clicked the login-submit button
                        if (submitter && submitter.getAttribute('data-testid') === 'login-submit') {
                            Logger.debug('Forcing submit because login-submit button was clicked', 'AUTH');
                        } else {
                            Logger.warn('Ignoring submit: login form appears inactive', 'AUTH');
                            return;
                        }
                    }

                    const emailInput = loginForm.email || loginForm.querySelector('#loginEmail');
                    const passwordInput = loginForm.password || loginForm.querySelector('#loginPassword');
                    const submitBtn = loginForm.querySelector('button[type="submit"]') || (submitter && submitter.type === 'submit' ? submitter : null);

                    const email = emailInput ? emailInput.value : '';
                    const password = passwordInput ? passwordInput.value : '';

                    if (!email || !password) {
                        notify('Completa email y contraseña.', 'warning');
                        return;
                    }

                    // UI Loading state
                    const originalText = submitBtn ? submitBtn.textContent : 'Iniciar Sesión';
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Iniciando sesión...';
                    }

                    try {
                        emailAuthInProgress = true;
                        Logger.debug(`Attempting login with email: ${email}`, 'AUTH');
                        const appCheckReady = await ensureAppCheckForAuth();
                        if (!appCheckReady) {
                            return;
                        }
                        await ensureLocalPersistence();
                        const userCredential = await firebase
                            .auth()
                            .signInWithEmailAndPassword(email, password);
                        Logger.info(`Login successful: ${userCredential.user.email}`, 'AUTH');
                        loginForm.reset();
          const loginOk = await handleLoginSuccess(userCredential);
          if (!loginOk) {
            Logger.warn('Login canceled by post-auth checks', 'AUTH');
            notify(
              'No se pudo completar el inicio de sesión con esta cuenta.',
              'warning'
            );
          }
                    } catch (error) {
                        Logger.error('Login error', 'AUTH', error);
                        const errCode = (error && error.code) || 'unknown';
                        const errMsg = (error && error.message) || '';
                        console.warn('[AUTH LOGIN ERROR]', { errCode, errMsg });
                        if (
                            window.location &&
                            (window.location.hostname === 'localhost' ||
                                window.location.hostname === '127.0.0.1')
                        ) {
                            notify(`LOGIN ERROR: ${errCode}`, 'warning');
                        }
                        handleAuthInfraError(error);
                        const handled = await handleMfaLogin(error);
                        if (!handled) {
                            if (
                                error &&
                                (error.code === 'auth/invalid-credential' ||
                                    error.code === 'auth/invalid-login-credentials')
                            ) {
                                await diagnoseCredentialError(email);
                                const resetSent = await offerPasswordResetOnInvalidCredential(
                                    email
                                );
                                if (resetSent) {
                                    return;
                                }
                            }
                            handleAuthError(error);
                        }
                    } finally {
                        emailAuthInProgress = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = originalText;
                        }
                    }
                });
            }
        }

        // 2. Manejo de Registro con reCAPTCHA Invisible
        if (registerForm) {
            // Callback global para reCAPTCHA invisible
            globalThis.onRecaptchaRegisterSuccess = token => {
                Logger.debug('reCAPTCHA token recibido', 'AUTH');
                registerForm.dataset.recaptchaToken = token;
                // Disparar submit programáticamente
                const submitEvent = new Event('submit', {
                    bubbles: true,
                    cancelable: true,
                });
                registerForm.dispatchEvent(submitEvent);
            };

            registerForm.addEventListener('submit', async e => {
                e.preventDefault();

                // Detectar si estamos en localhost
                const isLocalhost =
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

                // Verificar token de reCAPTCHA (solo en producción)
                const recaptchaToken = registerForm.dataset.recaptchaToken;
                if (!isLocalhost && !recaptchaToken) {
                    // Si no hay token y NO estamos en localhost, el botón g-recaptcha se encargará de obtenerlo
                    Logger.debug('Esperando verificación reCAPTCHA...', 'AUTH');
                    return;
                }

                if (isLocalhost) {
                    Logger.debug('Localhost detectado - reCAPTCHA omitido', 'AUTH');
                }

                const name = registerForm.name.value;
                const email = registerForm.email.value;
                const password = registerForm.password.value;
                const website = registerForm.website ? registerForm.website.value : '';
                const confirmPassword = registerForm.confirmPassword ?
                    registerForm.confirmPassword.value :
                    null;

                if (confirmPassword && password !== confirmPassword) {
                    notify('Las contraseñas no coinciden', 'error');
                    // Resetear reCAPTCHA para nuevo intento
                    if (globalThis.grecaptcha) grecaptcha.reset();
                    delete registerForm.dataset.recaptchaToken;
                    return;
                }

                // Verificar IP antes de registrar (usando función global si existe)
                if (globalThis.checkIPBeforeRegistration) {
                    const canRegister = await globalThis.checkIPBeforeRegistration(email, {
                        website,
                        userAgent: globalThis.navigator?.userAgent || '',
                    });
                    if (!canRegister) {
                        if (globalThis.grecaptcha) grecaptcha.reset();
                        delete registerForm.dataset.recaptchaToken;
                        return;
                    }
                }

                const submitBtn = registerForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;

                submitBtn.disabled = true;
                submitBtn.textContent = 'Creando cuenta...';

                try {
                    const appCheckReady = await ensureAppCheckForAuth();
                    if (!appCheckReady) {
                        return;
                    }
                    const result = await firebase
                        .auth()
                        .createUserWithEmailAndPassword(email, password);

                    Logger.info(`User created: ${result.user.uid}`, 'AUTH');

                    // Actualizar perfil con nombre (Firebase v9+ compatible)
                    try {
                        await result.user.updateProfile({
                            displayName: name,
                        });
                        Logger.debug(`Profile updated with name: ${name}`, 'AUTH');
                    } catch (profileError) {
                        Logger.warn('Could not update profile, continuing...', 'AUTH', profileError);
                        // No bloquear el registro si falla la actualización del perfil
                    }

                    // Crear documento de usuario en Firestore
                    await firebase
                        .firestore()
                        .collection('users')
                        .doc(result.user.uid)
                        .set({
                            uid: result.user.uid,
                            name: name,
                            email: email,
                            displayName: name,
                            role: 'user',
                            status: 'active',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                        });

                    Logger.debug('User document created in Firestore', 'AUTH');

                    // Actualizar ubicación del usuario (IP y país)
                    try {
                        const updateLocation = firebase
                            .functions()
                            .httpsCallable('updateUserLocation');
                        await updateLocation();
                        Logger.debug('User location updated', 'AUTH');
                    } catch (locationError) {
                        Logger.warn('Could not update user location', 'AUTH', locationError);
                        // No bloquear el registro si falla
                    }

                    // Enviar email de verificación
                    try {
                        // Obtener el usuario actual después de la creación
                        const currentUser = firebase.auth().currentUser;
                        if (currentUser) {
                            await currentUser.sendEmailVerification();
                            Logger.debug('Verification email sent', 'AUTH');
                            notify(
                                '¡Cuenta creada exitosamente! Por favor verifica tu email.',
                                'success'
                            );
                        } else {
                            Logger.warn('No current user found for email verification', 'AUTH');
                            notify('¡Cuenta creada exitosamente!', 'success');
                        }
                    } catch (emailError) {
                        Logger.warn('Could not send verification email', 'AUTH', emailError);
                        notify('¡Cuenta creada exitosamente!', 'success');
                    }

                    // Reset form
                    registerForm.reset();

                    // Wait a bit for auth state to propagate
                    await new Promise(resolve => setTimeout(resolve, 500));

                    Logger.debug(
                        'Navigating to home view after registration...',
                        'AUTH'
                    );
                    showHomeViewSafe();
                    restoreHeaderFooter('after registration');
                } catch (error) {
                    handleAuthError(error);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    // Limpiar reCAPTCHA después del intento
                    if (globalThis.grecaptcha) grecaptcha.reset();
                    delete registerForm.dataset.recaptchaToken;
                }
            });
        }

        // 3. Manejo de Reset Password
        if (resetForm) {
            resetForm.addEventListener('submit', async e => {
                e.preventDefault();

                const email = resetForm.email.value;
                const submitBtn = resetForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;

                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';

                try {
                    await firebase.auth().sendPasswordResetEmail(email);
                    notify(
                        'Se ha enviado un enlace de recuperación a tu correo.',
                        'success'
                    );
                    resetForm.reset();
                } catch (error) {
                    handleAuthError(error);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        }

        // 4. Google Login
        // Flag para prevenir múltiples popups simultáneos
        let googleAuthInProgress = false;

        const handleGoogleAuth = async (arg1, arg2) => {
            const e =
                arg1 && typeof arg1.preventDefault === 'function' ?
                arg1 :
                arg2 && typeof arg2.preventDefault === 'function' ?
                arg2 :
                null;
            // Detener propagación para evitar conflictos con otros scripts
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
            }
            // Prevenir múltiples popups simultáneos
            if (googleAuthInProgress) {
                Logger.warn('Google auth already in progress, ignoring click', 'AUTH');
                return;
            }

            googleAuthInProgress = true;
            globalThis._googleAuthStartTime = Date.now();

            try {
                Logger.debug('Iniciando autenticación con Google...', 'AUTH');
                const provider = new firebase.auth.GoogleAuthProvider();
                // Keep user-activation alive for popup browsers (Firefox/Safari):
                // do not await async work before signInWithPopup.
                ensureLocalPersistence().catch(error => {
                    Logger.warn('Could not ensure local persistence before Google auth', 'AUTH', error);
                });

                // Configurar provider para forzar selección de cuenta y añadir scopes necesarios
                provider.setCustomParameters({
                    prompt: 'select_account',
                    access_type: 'offline',
                    include_granted_scopes: 'true',
                });

                // Añadir scopes básicos de Google
                provider.addScope('email');
                provider.addScope('profile');

                const result = await firebase.auth().signInWithPopup(provider);
                Logger.info('Google auth successful', 'AUTH');

                if (globalThis.BanSystem && globalThis.BanSystem.checkBanStatus) {
                    setTimeout(async () => {
                        try {
                            const banStatus = await globalThis.BanSystem.checkBanStatus(
                                result.user.uid
                            );
                            if (banStatus && banStatus.banned) {
                                Logger.warn('Usuario baneado', 'AUTH', banStatus);
                                if (
                                    globalThis.BanSystem &&
                                    globalThis.BanSystem.showBannedModal
                                ) {
                                    globalThis.BanSystem.showBannedModal(banStatus);
                                } else {
                                    alert('ACCESO DENEGADO: Cuenta suspendida.');
                                }
                                await firebase.auth().signOut();
                            }
                        } catch (banError) {
                            Logger.warn('Ban check background failed', 'AUTH', banError);
                        }
                    }, 0);
                }

                const isAdminAtLogin = await resolveAdminStatus(result.user);
                debugAdminResolution(result.user, 'google_login');

                // Crear/Actualizar usuario en Firestore
                const userRef = firebase
                    .firestore()
                    .collection('users')
                    .doc(result.user.uid);
                const userDoc = await userRef.get();

                if (userDoc.exists) {
                    await userRef.update({
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    });
                } else {
                    await userRef.set({
                        uid: result.user.uid,
                        name: result.user.displayName,
                        email: result.user.email,
                        photoURL: result.user.photoURL,
                        role: isAdminAtLogin ? 'admin' : 'user',
                        status: 'active',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                        provider: 'google',
                    });
                }

                // Sincronizar estado admin inmediatamente tras login Google
                try {
                    const prev = AppState.getState('user') || {};
                    AppState.setState('user', {
                        ...prev,
                        uid: result.user.uid,
                        email: result.user.email,
                        displayName: result.user.displayName || result.user.email || 'Usuario',
                        isAuthenticated: true,
                        isAdmin: isAdminAtLogin,
                        role: isAdminAtLogin ? 'admin' : 'client',
                    });
                    const adminBtns = document.querySelectorAll('.header-admin-btn');
                    adminBtns.forEach(adminBtn => {
                        if (isAdminAtLogin) {
                            adminBtn.removeAttribute('hidden');
                        } else {
                            adminBtn.setAttribute('hidden', '');
                        }
                    });
                } catch (syncError) {
                    Logger.warn('Could not sync admin state after Google login', 'AUTH', syncError);
                }

                // Actualizar ubicación del usuario (IP y país)
                try {
                    const updateLocation = firebase
                        .functions()
                        .httpsCallable('updateUserLocation');
                    await updateLocation();
                    Logger.debug('User location updated', 'AUTH');
                } catch (locationError) {
                    Logger.warn('Could not update user location', 'AUTH', locationError);
                    // No bloquear el login si falla
                }

                // Cerrar modal de login
                const loginView = document.getElementById('loginView');
                if (loginView) {
                    loginView.classList.remove('active');
                    loginView.classList.add('hidden');
                    window.DOMUtils.setDisplay(loginView, 'none');
                    loginView.setAttribute('aria-hidden', 'true');
                }

                // Esperar un momento para que se propague el estado de auth
                await new Promise(resolve => setTimeout(resolve, 500));

                Logger.debug('Navigating to home view...', 'AUTH');
                showHomeViewSafe();
                restoreHeaderFooter();
            } catch (error) {
                Logger.error('Google Auth Error', 'AUTH', error);
                if (error.code === 'auth/multi-factor-auth-required') {
                    const handled = await handleMfaLogin(error);
                    if (handled) {
                        return;
                    }
                }

                // Fallback a Redirect si falla el popup
        if (
          error.code === 'auth/popup-blocked' ||
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/internal-error' ||
          error.code === 'auth/too-many-requests'
        ) {
                    // Si es internal error, preguntar al usuario
                    if (error.code === 'auth/internal-error') {
                        if (
                            confirm(
                                'Hubo un problema con la ventana emergente. ¿Intentar con redirección completa?'
                            )
                        ) {
                            const provider = new firebase.auth.GoogleAuthProvider();
                            provider.setCustomParameters({
                                prompt: 'select_account',
                            });
                            firebase.auth().signInWithRedirect(provider);
                            return;
                        }
          } else if (
            error.code === 'auth/popup-blocked' ||
            error.code === 'auth/too-many-requests'
          ) {
            // Si está bloqueado, intentar redirect puede ser mejor
            notify(
              error.code === 'auth/too-many-requests'
                ? 'Google temporalmente limitado. Intentando redirección...'
                : 'Popup bloqueado. Intentando redirección...',
              'warning'
            );
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithRedirect(provider);
            return;
                    }
                }
                if (
                    error &&
                    (error.code === 'auth/invalid-credential' ||
                        error.code === 'auth/invalid-login-credentials')
                ) {
                    notify('Error al iniciar con Google. Intenta nuevamente.', 'error');
                } else {
                    handleAuthError(error);
                }
            } finally {
                setTimeout(() => {
                    googleAuthInProgress = false;
                    Logger.debug('Google auth flag released', 'AUTH');
                }, 1000);
            }
        };

        // Registrar handlers con EventDelegation (con reintentos por carga diferida)
        const bindGoogleDirectFallback = () => {
            googleLoginBtns.forEach(btn => {
                if (btn.dataset.googleAuthBound !== '1') {
                    btn.dataset.googleAuthBound = '1';
                    btn.addEventListener('click', handleGoogleAuth);
                }
            });
            googleRegisterBtns.forEach(btn => {
                if (btn.dataset.googleAuthBound !== '1') {
                    btn.dataset.googleAuthBound = '1';
                    btn.addEventListener('click', handleGoogleAuth);
                }
            });
            Logger.debug('Google auth fallback listeners bound directly', 'AUTH');
        };

        const registerGoogleDelegationHandlers = (attempt = 0) => {
            const delegation = globalThis.EventDelegation;
            if (delegation && typeof delegation.registerHandler === 'function') {
                // Always overwrite to guarantee latest real handler wins over placeholders.
                delegation.registerHandler('loginWithGoogle', handleGoogleAuth);
                delegation.registerHandler('registerWithGoogle', handleGoogleAuth);
                Logger.debug(
                    'Google auth handlers registered with EventDelegation',
                    'AUTH'
                );
                return;
            }

            if (attempt < 8) {
                setTimeout(() => registerGoogleDelegationHandlers(attempt + 1), 300);
                return;
            }
            bindGoogleDirectFallback();
        };
        registerGoogleDelegationHandlers(0);

        Logger.debug('Listeners de autenticación configurados', 'AUTH');
    };

    /**
     * Firebase Auth State Observer - Centralizado vía AuthManager
     */
    const setupAuthStateObserver = async () => {
        if (observerInitialized || !window.AuthManager) return;
        observerInitialized = true;

        Logger.debug(
            'Configurando observador de estado vía AuthManager...',
            'AUTH'
        );

        window.AuthManager.registerUniqueAuthHandler(
            'auth_js_observer',
            async user => {
                Logger.info(
                    user ?
                    `Auth state changed: ${user.email}` :
                    'Auth state changed: No user',
                    'AUTH'
                );

                try {
                    if (user) {
                        const previousUser = AppState.getState('user') || {};
                        const hasCachedAdmin =
                            previousUser.uid === user.uid && previousUser.isAdmin === true;
                        const hasPersistedAdmin = localStorage.getItem('isAdmin') === 'true';
                        const seedAdmin = hasCachedAdmin || hasPersistedAdmin;

                        // Usuario autenticado - actualizar AppState
                        const userData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || user.email || 'Usuario',
                            photoURL: user.photoURL || null,
                            isAuthenticated: true,
                            isAdmin: seedAdmin,
                            role: seedAdmin ? 'admin' : 'client',
                        };

                        // Update AppState with user data (rápido)
                        AppState.setState('user', userData);
                        Logger.debug('User state updated in AppState', 'AUTH');

                        // Verificar si es admin en background (no bloquear UI)
                        (async () => {
                            try {
                                let isAdmin = await resolveAdminStatus(user);
                                if (!isAdmin) {
                                    // Services/settings may load after auth event; retry once.
                                    await new Promise(resolve => setTimeout(resolve, 700));
                                    isAdmin = await resolveAdminStatus(user);
                                }
                                debugAdminResolution(user, 'auth_observer');
                                if (isAdmin) {
                                    userData.isAdmin = true;
                                    userData.role = 'admin';
                                    Logger.debug('User is admin', 'AUTH');

                                    try {
                                        localStorage.setItem('isAdmin', 'true');
                                        Logger.debug('isAdmin guardado en localStorage', 'AUTH');
                                    } catch (e) {
                                        Logger.warn(
                                            'No se pudo guardar isAdmin en localStorage',
                                            'AUTH',
                                            e
                                        );
                                    }
                                } else {
                                    try {
                                        localStorage.removeItem('isAdmin');
                                    } catch (e) {}
                                }

                                // Actualizar AppState sin bloquear
                                AppState.setState('user', {
                                    ...userData
                                });

                                // Show/hide admin button based on role
                                const adminBtns = document.querySelectorAll('.header-admin-btn');
                                adminBtns.forEach(adminBtn => {
                                    if (userData.isAdmin) {
                                        adminBtn.removeAttribute('hidden');
                                    } else {
                                        adminBtn.setAttribute('hidden', '');
                                    }
                                });
                                if (userData.isAdmin) {
                                    Logger.debug('Admin button shown', 'AUTH');
                                }
                            } catch (error) {
                                Logger.warn('Could not check admin status', 'AUTH', error);
                            }
                        })();
                        // Actualizar ubicación del usuario (IP y país) en background
                        try {
                            const updateLocation = firebase
                                .functions()
                                .httpsCallable('updateUserLocation');
                            updateLocation().catch(locationError => {
                                Logger.warn(
                                    'Could not update user location',
                                    'AUTH',
                                    locationError
                                );
                            });
                        } catch (locationError) {
                            Logger.warn('Could not update user location', 'AUTH', locationError);
                        }

                        updateLoginButton(userData);

                        // CRITICAL: Ocultar loginView si está visible
                        // auth-init-early.js ya manejó la vista inicial
                        const loginView = document.getElementById('loginView');

                        if (loginView) {
                            loginView.classList.remove('active');
                            loginView.classList.add('hidden');
                            window.DOMUtils.setDisplay(loginView, 'none');
                            loginView.setAttribute('aria-hidden', 'true');
                            Logger.debug('Login view hidden (user authenticated)', 'AUTH');
                            if (
                                document.body &&
                                document.body.getAttribute('data-current-view') === 'loginView'
                            ) {
                                syncViewState('homeView');
                            }
                        }


                    } else {
                        // No hay usuario - clear AppState
                        AppState.setState('user', {
                            uid: null,
                            email: null,
                            displayName: null,
                            photoURL: null,
                            isAuthenticated: false,
                            isAdmin: false,
                            role: 'client',
                        });
                        Logger.debug('User state cleared in AppState', 'AUTH');

                        updateLoginButton(null);

                        // Ocultar botón admin
                        const adminBtn = document.querySelector('.header-admin-btn');
                        if (adminBtn) {
                            adminBtn.setAttribute('hidden', '');
                        }
                    }
                } catch (error) {
                    Logger.error('Error in auth observer', 'AUTH', error);
                }
            }
        );
    };

    // Inicializar cuando Firebase esté listo
    const init = () => {
        if (isInitialized) return;
        if (typeof firebase !== 'undefined' && firebase.auth) {
            isInitialized = true;
            Logger.debug('Firebase detectado, configurando listeners...', 'AUTH');
            setupAuthListeners();
            setupAuthStateObserver();
        } else {
            Logger.debug('Esperando SDK de Firebase...', 'AUTH');
            setTimeout(init, 500);
        }
    };

    // Escuchar evento firebaseReady
    globalThis.addEventListener('firebaseReady', () => {
        Logger.debug('Evento firebaseReady recibido', 'AUTH');
        init();
    });

    // Fallback: intentar inicializar de todas formas
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Subscribe to user state changes from AppState
    // This allows external code to update auth state programmatically
    AppState.subscribe('user', (newUser, oldUser) => {
        Logger.debug('User state changed via AppState observer', 'AUTH');
        Logger.debug(
            `Old user: ${(oldUser && oldUser.email) || 'none'}`,
            'AUTH'
        );
        Logger.debug(
            `New user: ${(newUser && newUser.email) || 'none'}`,
            'AUTH'
        );

        // NOTA: No actualizamos el botón aquí para evitar flicker
        // El onAuthStateChanged de Firebase es la fuente de verdad y actualiza el botón
        // Este observer solo se usa para sincronización de estado entre módulos
    });
})();

