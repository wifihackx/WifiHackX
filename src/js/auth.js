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

(function () {
  'use strict';

  // Use AppState from window
  const AppState = globalThis.AppState;
  const Logger = globalThis.Logger || {
    info: (...args) => console.log(...args),
    debug: (...args) => console.debug(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  };

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

  const setupAuthListeners = () => {
    if (listenersInitialized) return;
    listenersInitialized = true;
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

    // CONFIGURACIÓN GLOBAL
    firebase.auth().useDeviceLanguage();

    // 0. Manejar Resultado de Redirect (Fallback)
    firebase
      .auth()
      .getRedirectResult()
      .then(result => {
        if (result && result.user) {
          Logger.info('Login via Redirect successful', 'AUTH');
          const displayName =
            result.user.displayName ||
            result.user.email.split('@')[0] ||
            'Usuario';
          notify(`¡Bienvenido ${displayName}!`, 'success');

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
        const verificationId = await provider.verifyPhoneNumber(
          { multiFactorHint: hint, session: mfaResolver.session },
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

      // VERIFICAR EMAIL VERIFICADO
      if (!userCredential.user.emailVerified) {
        Logger.warn(`Email no verificado: ${userCredential.user.email}`, 'AUTH');

        const wantsResend = confirm(
          'Tu email no está verificado. ¿Deseas que te reenviemos el email de verificación?'
        );

        if (wantsResend) {
          try {
            Logger.debug('Intentando reenviar email de verificación...', 'AUTH');
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
              await currentUser.sendEmailVerification();
              Logger.info(
                'Email de verificación reenviado exitosamente',
                'AUTH'
              );
              notify(
                'Email de verificación reenviado. Revisa tu bandeja de entrada.',
                'success'
              );
            } else {
              Logger.warn('No current user found', 'AUTH');
              notify('Error al reenviar email. Intenta más tarde.', 'error');
            }
          } catch (emailError) {
            Logger.error('Error reenviando email', 'AUTH', emailError);

            let errorMsg = 'Error al reenviar email. ';
            if (emailError.code === 'auth/too-many-requests') {
              errorMsg +=
                'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
            } else if (emailError.code === 'auth/user-token-expired') {
              errorMsg += 'Sesión expirada. Intenta iniciar sesión de nuevo.';
            } else {
              errorMsg += 'Intenta más tarde o contacta al administrador.';
            }

            notify(errorMsg, 'error');
          }
        }

        await firebase.auth().signOut();
        notify('Por favor verifica tu email antes de iniciar sesión.', 'warning');
        return false;
      }

      // VERIFICAR ESTADO DE BANEO ANTES DE CONTINUAR
      if (globalThis.BanSystem && globalThis.BanSystem.checkBanStatus) {
        let banStatus = null;
        try {
          banStatus = await withTimeout(
            globalThis.BanSystem.checkBanStatus(userCredential.user.uid),
            3000,
            'Ban check'
          );
        } catch (banError) {
          Logger.warn('Ban check delayed', 'AUTH', banError);
        }

        if (banStatus && banStatus.banned) {
          Logger.warn('Usuario baneado detectado', 'AUTH', banStatus);
          if (globalThis.BanSystem && globalThis.BanSystem.showBannedModal) {
            globalThis.BanSystem.showBannedModal(banStatus);
          } else {
            alert(
              `ACCESO DENEGADO\n\nTu cuenta ha sido suspendida.\nMotivo: ${banStatus.reason}${banStatus.expiresAt ? '\nExpira: ' + banStatus.expiresAt.toLocaleString() : ''}`
            );
          }
          await firebase.auth().signOut();
          return false;
        }

        if (!banStatus) {
          setTimeout(async () => {
            try {
              const bgStatus = await globalThis.BanSystem.checkBanStatus(
                userCredential.user.uid
              );
              if (bgStatus && bgStatus.banned) {
                if (
                  globalThis.BanSystem &&
                  globalThis.BanSystem.showBannedModal
                ) {
                  globalThis.BanSystem.showBannedModal(bgStatus);
                } else {
                  alert('ACCESO DENEGADO: Cuenta suspendida.');
                }
                await firebase.auth().signOut();
              }
            } catch (_e) {}
          }, 0);
        }
      }

      notify('¡Bienvenido de nuevo!', 'success');
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

    // 1. Manejo de Login
    if (loginForm) {
      loginForm.addEventListener('submit', async e => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        Logger.debug('Login form submission intercepted', 'AUTH');

        const email = loginForm.email.value;
        const password = loginForm.password.value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // UI Loading state
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Iniciando sesión...';

        try {
          Logger.debug(`Attempting login with email: ${email}`, 'AUTH');
          await ensureLocalPersistence();
          const userCredential = await firebase
            .auth()
            .signInWithEmailAndPassword(email, password);
          Logger.info(`Login successful: ${userCredential.user.email}`, 'AUTH');
          loginForm.reset();
          await handleLoginSuccess(userCredential);
        } catch (error) {
          Logger.error('Login error', 'AUTH', error);
          const handled = await handleMfaLogin(error);
          if (!handled) {
            handleAuthError(error);
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
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
        const confirmPassword = registerForm.confirmPassword
          ? registerForm.confirmPassword.value
          : null;

        if (confirmPassword && password !== confirmPassword) {
          notify('Las contraseñas no coinciden', 'error');
          // Resetear reCAPTCHA para nuevo intento
          if (globalThis.grecaptcha) grecaptcha.reset();
          delete registerForm.dataset.recaptchaToken;
          return;
        }

        // Verificar IP antes de registrar (usando función global si existe)
        if (globalThis.checkIPBeforeRegistration) {
          const canRegister = await globalThis.checkIPBeforeRegistration(email);
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

    const handleGoogleAuth = async e => {
      // Detener propagación para evitar conflictos con otros scripts
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
      // Prevenir múltiples popups simultáneos
      if (googleAuthInProgress) {
        Logger.warn('Google auth already in progress, ignoring click', 'AUTH');
        return;
      }

      googleAuthInProgress = true;

      try {
        Logger.debug('Iniciando autenticación con Google...', 'AUTH');
        const provider = new firebase.auth.GoogleAuthProvider();
        await ensureLocalPersistence();

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
          const banStatus = await globalThis.BanSystem.checkBanStatus(
            result.user.uid
          );
          if (banStatus && banStatus.banned) {
            Logger.warn('Usuario baneado', 'AUTH', banStatus);
            if (globalThis.BanSystem && globalThis.BanSystem.showBannedModal) {
              globalThis.BanSystem.showBannedModal(banStatus);
            } else {
              alert('ACCESO DENEGADO: Cuenta suspendida.');
            }
            await firebase.auth().signOut();
            return;
          }
        }

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
            role: 'user',
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            provider: 'google',
          });
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

        const displayName =
          result.user.displayName ||
          result.user.email.split('@')[0] ||
          'Usuario';
        notify(`¡Bienvenido ${displayName}!`, 'success');

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
          error.code === 'auth/internal-error'
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
          } else if (error.code === 'auth/popup-blocked') {
            // Si está bloqueado, intentar redirect puede ser mejor
            notify('Popup bloqueado. Intentando redirección...', 'warning');
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithRedirect(provider);
            return;
          }
        }
        handleAuthError(error);
      } finally {
        setTimeout(() => {
          googleAuthInProgress = false;
          Logger.debug('Google auth flag released', 'AUTH');
        }, 1000);
      }
    };

    // Registrar handlers con EventDelegation
    if (globalThis.EventDelegation) {
      globalThis.EventDelegation.registerHandler(
        'loginWithGoogle',
        handleGoogleAuth
      );
      globalThis.EventDelegation.registerHandler(
        'registerWithGoogle',
        handleGoogleAuth
      );
      Logger.debug(
        'Google auth handlers registered with EventDelegation',
        'AUTH'
      );
    }

    googleLoginBtns.forEach(btn => {
      btn.addEventListener('click', handleGoogleAuth);
    });
    googleRegisterBtns.forEach(btn => {
      btn.addEventListener('click', handleGoogleAuth);
    });

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
          user
            ? `Auth state changed: ${user.email}`
            : 'Auth state changed: No user',
          'AUTH'
        );

        try {
          if (user) {
            // Usuario autenticado - actualizar AppState
            const userData = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email || 'Usuario',
              photoURL: user.photoURL || null,
              isAuthenticated: true,
              isAdmin: false,
              role: 'client',
            };

            // Update AppState with user data (rápido)
            AppState.setState('user', userData);
            Logger.debug('User state updated in AppState', 'AUTH');

            // Verificar si es admin en background (no bloquear UI)
            (async () => {
              try {
                const isAdmin =
                  window.WFX_ADMIN && typeof window.WFX_ADMIN.isAdmin === 'function'
                    ? await window.WFX_ADMIN.isAdmin(user, false)
                    : (await user.getIdTokenResult()).claims.admin === true;

                if (isAdmin) {
                  userData.isAdmin = true;
                  userData.role = 'admin';
                  Logger.debug('User is admin (via custom claims)', 'AUTH');

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
                AppState.setState('user', { ...userData });

                // Show/hide admin button based on role
                const adminBtn = document.querySelector('.header-admin-btn');
                if (adminBtn) {
                  if (userData.isAdmin) {
                    adminBtn.removeAttribute('hidden');
                    Logger.debug('Admin button shown', 'AUTH');
                  } else {
                    adminBtn.setAttribute('hidden', '');
                  }
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





