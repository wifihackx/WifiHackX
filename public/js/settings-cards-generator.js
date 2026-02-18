/**
 * Settings Cards Generator - Genera tarjetas de configuración dinámicamente
 * Reduce código HTML duplicado en index.html
 *
 * @version 2.0.0
 * @description Este módulo crea elementos del DOM directamente usando createElement()
 *              y appendChild() en lugar de generar strings HTML. Este enfoque evita
 *              problemas con XSSProtection que eliminaba los tags <input> durante
 *              la sanitización, y es más seguro y eficiente.
 *
 * @architecture
 * - createSettingElement(): Crea un input individual con su label
 * - createSettingsCardElement(): Crea una tarjeta con múltiples settings
 * - renderSettingsCards(): Renderiza todas las tarjetas en el contenedor
 * - init(): Inicializa el módulo cuando el DOM está listo
 *
 * @security
 * - No usa innerHTML ni setInnerHTML()
 * - Crea elementos directamente con document.createElement()
 * - No hay riesgo de XSS porque no se parsea HTML
 * - Todos los inputs son editables por defecto
 */

'use strict';

function setupSettingsCardsGenerator() {
  const TWO_FACTOR_MODAL_ID = 'twoFactorModalOverlay';

  /**
   * Configuración de tarjetas de settings
   */
  const SETTINGS_CARDS_CONFIG = [
    {
      title: 'Configuración General',
      settings: [
        {
          id: 'settingSiteName',
          label: 'Nombre del Sitio',
          type: 'text',
          value: '',
          placeholder: 'Nombre del sitio',
        },
        {
          id: 'settingContactEmail',
          label: 'Email de Contacto',
          type: 'email',
          value: '',
          placeholder: 'correo@dominio.com',
        },
        {
          id: 'settingMaintenanceMode',
          label: 'Modo Mantenimiento',
          type: 'checkbox',
          checked: false,
        },
        {
          id: 'settingAdminInfoNotifications',
          label: 'Mostrar notificaciones informativas en admin',
          type: 'checkbox',
          checked: false,
        },
        {
          id: 'settingAdminStrictNotifications',
          label: 'Modo estricto: solo warnings y errores',
          type: 'checkbox',
          checked: true,
        },
      ],
    },
    {
      title: 'Configuración de Seguridad',
      settings: [
        {
          id: 'setting2FA',
          label: 'Autenticación de Dos Factores',
          type: 'checkbox',
          checked: false,
        },
        {
          id: 'settingSessionTimeout',
          label: 'Timeout de Sesión (minutos)',
          type: 'number',
          value: '30',
        },
        {
          id: 'settingBackupCodesThreshold',
          label: 'Umbral aviso códigos de respaldo',
          type: 'number',
          value: '2',
        },
        {
          id: 'settingAdminAllowlistEmails',
          label: 'Admins por email (separar por coma)',
          type: 'text',
          value: '',
          placeholder: 'admin@dominio.com, otro@dominio.com',
        },
        {
          id: 'settingAdminAllowlistUids',
          label: 'Admins por UID (separar por coma)',
          type: 'text',
          value: '',
          placeholder: 'uid1, uid2',
        },
        {
          id: 'settingSecurityLogs',
          label: 'Logs de Seguridad',
          type: 'checkbox',
          checked: true,
        },
      ],
    },
    {
      title: 'Configuración de Email',
      settings: [
        {
          id: 'settingSmtpServer',
          label: 'Servidor SMTP',
          type: 'text',
          value: '',
          placeholder: 'smtp.tudominio.com',
        },
        {
          id: 'settingSmtpPort',
          label: 'Puerto',
          type: 'number',
          value: '',
          placeholder: '587',
        },
        {
          id: 'settingEmailNotifications',
          label: 'Notificaciones Email',
          type: 'checkbox',
          checked: false,
        },
      ],
    },
  ];

  /**
   * Crea un input element directamente (sin innerHTML)
   * @param {Object} setting - Configuración del setting
   * @returns {HTMLElement} Elemento del setting item
   */
  function createSettingElement(setting) {
    const settingItem = document.createElement('div');
    settingItem.className = 'setting-item';

    const label = document.createElement('label');
    label.setAttribute('for', setting.id);
    label.textContent = setting.label;

    const input = document.createElement('input');
    input.type = setting.type;
    input.id = setting.id;
    input.className =
      setting.type === 'checkbox' ? 'setting-toggle' : 'setting-input';

    if (setting.value) {
      input.value = setting.value;
    }

    if (setting.checked) {
      input.checked = true;
    }

    if (setting.placeholder) {
      input.placeholder = setting.placeholder;
    }

    // Asegurar que sea editable
    input.removeAttribute('readonly');
    input.removeAttribute('disabled');

    settingItem.appendChild(label);
    settingItem.appendChild(input);

    if (setting.id === 'settingAdminInfoNotifications') {
      const hint = document.createElement('small');
      hint.className = 'setting-help-text';
      hint.textContent =
        'Muestra notificaciones tipo info en admin cuando el modo estricto está desactivado.';
      settingItem.appendChild(hint);
    }

    if (setting.id === 'settingAdminStrictNotifications') {
      const hint = document.createElement('small');
      hint.className = 'setting-help-text';
      hint.textContent =
        'Tiene prioridad sobre el ajuste anterior: en modo estricto solo se muestran warnings y errores.';
      settingItem.appendChild(hint);
    }

    if (setting.id === 'setting2FA') {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'setting-inline-action';
      actionBtn.dataset.action = 'openTwoFactorConfig';
      actionBtn.textContent = 'Configurar 2FA';
      actionBtn.setAttribute('aria-label', 'Abrir configuración de 2FA');
      settingItem.appendChild(actionBtn);
    }

    return settingItem;
  }

  /**
   * Crea una tarjeta de settings directamente (sin innerHTML)
   * @param {Object} card - Configuración de la tarjeta
   * @returns {HTMLElement} Elemento de la tarjeta
   */
  function createSettingsCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'settings-card';

    const title = document.createElement('h3');
    title.textContent = card.title;
    cardDiv.appendChild(title);

    card.settings.forEach(setting => {
      const settingElement = createSettingElement(setting);
      cardDiv.appendChild(settingElement);
    });

    return cardDiv;
  }

  /**
   * Renderiza todas las tarjetas de settings usando creación directa de DOM
   * Este enfoque evita XSSProtection y garantiza que los inputs sean editables
   */
  function renderSettingsCards() {
    const container = document.getElementById('settingsGrid');

    if (!container) {
      console.warn('[SettingsCards] Container #settingsGrid not found');
      return;
    }
    if (container.dataset.rendered === 'true') {
      const hasInputs = container.querySelectorAll('input').length > 0;
      if (hasInputs) return;
      // Si el contenedor quedó vacío por un re-render externo, reconstruir.
      container.dataset.rendered = 'false';
    }

    console.log('[SettingsCards] Creando elementos del DOM directamente...');

    // Limpiar contenedor
    container.innerHTML = '';

    // Crear y agregar cada tarjeta directamente al DOM
    SETTINGS_CARDS_CONFIG.forEach(card => {
      const cardElement = createSettingsCardElement(card);
      container.appendChild(cardElement);
    });
    container.dataset.rendered = 'true';

    console.log(
      '[SettingsCards] Rendered',
      SETTINGS_CARDS_CONFIG.length,
      'settings cards'
    );

    // Verificar inputs creados
    const allInputs = container.querySelectorAll('input');
    console.log('[SettingsCards] Inputs encontrados:', allInputs.length);

    if (allInputs.length === 0) {
      console.error(
        '[SettingsCards] ❌ No se encontraron inputs después de crear elementos del DOM'
      );
    } else {
      // Asegurar editabilidad y configurar estilos (defensivo)
      allInputs.forEach(input => {
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.classList.toggle('cursor-pointer', input.type === 'checkbox');
        input.classList.toggle('cursor-text', input.type !== 'checkbox');
        console.log(
          '[SettingsCards] Input configurado:',
          input.id,
          input.type,
          'editable:',
          !input.readOnly && !input.disabled
        );
      });
      console.log(
        '[SettingsCards] ✅',
        allInputs.length,
        'inputs creados correctamente'
      );
    }

    setupTwoFactorModal();
  }

  function buildTwoFactorModalContent(modalOverlay) {
    const modal = document.createElement('div');
    modal.className = 'two-factor-modal';
    modal.setAttribute('role', 'document');

    const header = document.createElement('div');
    header.className = 'two-factor-modal__header';

    const title = document.createElement('h2');
    title.id = 'twoFactorModalTitle';
    title.className = 'two-factor-modal__title';
    title.textContent = 'Activar autenticación de dos factores';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'two-factor-modal__close modal-close';
    closeBtn.setAttribute('aria-label', 'Cerrar modal');
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'two-factor-modal__body';

    const intro = document.createElement('p');
    intro.textContent =
      'Elige el método para proteger el acceso. Recomendamos app autenticadora (TOTP) + códigos de respaldo.';

    const smsSection = document.createElement('div');
    smsSection.id = 'twoFactorSmsSection';
    smsSection.className = 'two-factor-modal__section';

    const smsTitle = document.createElement('h3');
    smsTitle.className = 'two-factor-modal__section-title';
    smsTitle.textContent = 'Opción 1: Código SMS (Firebase MFA)';

    const phoneGroup = document.createElement('div');
    phoneGroup.className = 'two-factor-modal__group';

    const phoneLabel = document.createElement('label');
    phoneLabel.setAttribute('for', 'twoFactorPhone');
    phoneLabel.textContent = 'Número de teléfono';

    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.id = 'twoFactorPhone';
    phoneInput.placeholder = '+52 55 1234 5678';
    phoneInput.autocomplete = 'tel';
    phoneInput.className = 'two-factor-modal__input';

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'modal-btn primary';
    sendBtn.dataset.action = 'sendTwoFactorCode';
    sendBtn.textContent = 'Enviar código SMS';

    phoneGroup.appendChild(phoneLabel);
    phoneGroup.appendChild(phoneInput);
    phoneGroup.appendChild(sendBtn);

    const codeGroup = document.createElement('div');
    codeGroup.className = 'two-factor-modal__group';

    const codeLabel = document.createElement('label');
    codeLabel.setAttribute('for', 'twoFactorCode');
    codeLabel.textContent = 'Código de verificación';

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.id = 'twoFactorCode';
    codeInput.inputMode = 'numeric';
    codeInput.maxLength = 6;
    codeInput.placeholder = 'Ingresa el código';
    codeInput.className = 'two-factor-modal__input';

    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.className = 'modal-btn secondary';
    verifyBtn.dataset.action = 'verifyTwoFactorCode';
    verifyBtn.textContent = 'Verificar y activar';

    codeGroup.appendChild(codeLabel);
    codeGroup.appendChild(codeInput);
    codeGroup.appendChild(verifyBtn);

    const recaptchaContainer = document.createElement('div');
    recaptchaContainer.id = 'twoFactorRecaptcha';
    recaptchaContainer.className = 'two-factor-modal__recaptcha';

    smsSection.appendChild(smsTitle);
    smsSection.appendChild(phoneGroup);
    smsSection.appendChild(codeGroup);
    smsSection.appendChild(recaptchaContainer);

    const totpSection = document.createElement('div');
    totpSection.className = 'two-factor-modal__section';

    const totpTitle = document.createElement('h3');
    totpTitle.className = 'two-factor-modal__section-title';
    totpTitle.textContent = 'Opción 2: App autenticadora (TOTP)';

    const totpIntro = document.createElement('p');
    totpIntro.className = 'two-factor-modal__hint';
    totpIntro.textContent =
      'Escanea el QR con Google Authenticator, Authy o similar.';

    const totpActions = document.createElement('div');
    totpActions.className = 'two-factor-modal__group';

    const totpSetupBtn = document.createElement('button');
    totpSetupBtn.type = 'button';
    totpSetupBtn.className = 'modal-btn primary';
    totpSetupBtn.dataset.action = 'requestTotpSetup';
    totpSetupBtn.textContent = 'Generar QR';

    const totpQr = document.createElement('img');
    totpQr.id = 'twoFactorTotpQr';
    totpQr.className = 'two-factor-modal__qr hidden';
    totpQr.alt = 'Código QR para TOTP';

    const totpCodeGroup = document.createElement('div');
    totpCodeGroup.className = 'two-factor-modal__group';

    const totpCodeLabel = document.createElement('label');
    totpCodeLabel.setAttribute('for', 'twoFactorTotpCode');
    totpCodeLabel.textContent = 'Código de la app';

    const totpCodeInput = document.createElement('input');
    totpCodeInput.type = 'text';
    totpCodeInput.id = 'twoFactorTotpCode';
    totpCodeInput.inputMode = 'numeric';
    totpCodeInput.maxLength = 6;
    totpCodeInput.placeholder = 'Ej: 123456';
    totpCodeInput.className = 'two-factor-modal__input';

    const totpVerifyBtn = document.createElement('button');
    totpVerifyBtn.type = 'button';
    totpVerifyBtn.className = 'modal-btn secondary';
    totpVerifyBtn.dataset.action = 'verifyTotpEnable';
    totpVerifyBtn.textContent = 'Verificar y activar TOTP';

    totpActions.appendChild(totpSetupBtn);
    totpActions.appendChild(totpQr);

    totpCodeGroup.appendChild(totpCodeLabel);
    totpCodeGroup.appendChild(totpCodeInput);
    totpCodeGroup.appendChild(totpVerifyBtn);

    const backupSection = document.createElement('div');
    backupSection.className = 'two-factor-modal__section';

    const backupTitle = document.createElement('h3');
    backupTitle.className = 'two-factor-modal__section-title';
    backupTitle.textContent = 'Códigos de respaldo';

    const backupHint = document.createElement('p');
    backupHint.className = 'two-factor-modal__hint';
    backupHint.textContent =
      'Guarda estos códigos en un lugar seguro. Se usan una sola vez.';

    const backupList = document.createElement('div');
    backupList.id = 'twoFactorBackupList';
    backupList.className = 'two-factor-modal__backup-list';

    const backupActions = document.createElement('div');
    backupActions.className = 'two-factor-modal__group two-factor-modal__backup-actions';

    const backupGenerateBtn = document.createElement('button');
    backupGenerateBtn.type = 'button';
    backupGenerateBtn.className = 'modal-btn secondary';
    backupGenerateBtn.dataset.action = 'generateBackupCodes';
    backupGenerateBtn.textContent = 'Generar códigos';

    const backupDownloadBtn = document.createElement('button');
    backupDownloadBtn.type = 'button';
    backupDownloadBtn.className = 'modal-btn secondary';
    backupDownloadBtn.dataset.action = 'downloadBackupCodes';
    backupDownloadBtn.textContent = 'Descargar códigos';

    backupActions.appendChild(backupGenerateBtn);
    backupActions.appendChild(backupDownloadBtn);

    backupSection.appendChild(backupTitle);
    backupSection.appendChild(backupHint);
    backupSection.appendChild(backupList);
    backupSection.appendChild(backupActions);

    totpSection.appendChild(totpTitle);
    totpSection.appendChild(totpIntro);
    totpSection.appendChild(totpActions);
    totpSection.appendChild(totpCodeGroup);
    totpSection.appendChild(backupSection);

    const status = document.createElement('div');
    status.id = 'twoFactorStatus';
    status.className = 'two-factor-modal__status';
    status.setAttribute('role', 'status');

    body.appendChild(intro);
    body.appendChild(smsSection);
    body.appendChild(totpSection);
    body.appendChild(status);

    const footer = document.createElement('div');
    footer.className = 'two-factor-modal__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'modal-btn secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.dataset.action = 'cancelTwoFactor';

    footer.appendChild(cancelBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    modalOverlay.appendChild(modal);
  }

  function ensureTwoFactorModal() {
    let modalOverlay = document.getElementById(TWO_FACTOR_MODAL_ID);

    if (modalOverlay) {
      return modalOverlay;
    }

    modalOverlay = document.createElement('div');
    modalOverlay.id = TWO_FACTOR_MODAL_ID;
    modalOverlay.className = 'two-factor-modal-overlay';
    modalOverlay.style.display = 'none';
    modalOverlay.setAttribute('aria-hidden', 'true');
    modalOverlay.setAttribute('role', 'dialog');
    modalOverlay.setAttribute('aria-modal', 'true');
    modalOverlay.setAttribute('aria-labelledby', 'twoFactorModalTitle');

    buildTwoFactorModalContent(modalOverlay);

    document.body.appendChild(modalOverlay);
    updateTwoFactorCapabilities(modalOverlay);

    return modalOverlay;
  }

  function closeTwoFactorModal(options = {}) {
    const modalOverlay = document.getElementById(TWO_FACTOR_MODAL_ID);
    if (!modalOverlay) return;

    modalOverlay.classList.remove('active');
    modalOverlay.style.display = 'none';
    modalOverlay.setAttribute('aria-hidden', 'true');

    if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
      window.DOMUtils.lockBodyScroll(false);
    }

    if (options.revertToggle) {
      const toggleId = modalOverlay.dataset.triggerToggle;
      if (toggleId) {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
          const enrolled = toggle.dataset.enrolled === '1';
          toggle.checked = enrolled;
        }
      }
    }
  }

  function openTwoFactorModal(triggerToggle) {
    const modalOverlay = ensureTwoFactorModal();
    if (modalOverlay.parentElement !== document.body) {
      document.body.appendChild(modalOverlay);
    }

    updateTwoFactorCapabilities(modalOverlay);
    modalOverlay.dataset.triggerToggle = triggerToggle ? triggerToggle.id : '';
    modalOverlay.classList.add('active');
    modalOverlay.style.display = 'flex';
    modalOverlay.setAttribute('aria-hidden', 'false');

    if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
      window.DOMUtils.lockBodyScroll(true);
    }

    if (triggerToggle) {
      syncTwoFactorEnrollment(triggerToggle, modalOverlay);
    }
  }

  function notifyTwoFactor(message, type = 'info') {
    if (window.NotificationSystem && window.NotificationSystem[type]) {
      window.NotificationSystem[type](message);
    } else {
      alert(message);
    }
  }

  async function ensureFunctionsReady(timeoutMs = 8000) {
    const hasCompat = () => {
      const fb = window.firebase;
      return (
        !!fb &&
        typeof fb.functions === 'function' &&
        typeof fb.auth === 'function'
      );
    };
    const hasModular = () =>
      window.firebaseModular &&
      typeof window.firebaseModular.httpsCallable === 'function';

    if (hasCompat() || hasModular()) return true;

    return new Promise(resolve => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        window.removeEventListener('firebase:initialized', handler);
        window.removeEventListener('firebaseReady', handler);
        clearTimeout(timer);
        resolve(ok);
      };
      const handler = () => {
        if (hasCompat() || hasModular()) finish(true);
      };
      const timer = setTimeout(
        () => finish(hasCompat() || hasModular()),
        timeoutMs
      );
      window.addEventListener('firebase:initialized', handler, { once: true });
      window.addEventListener('firebaseReady', handler, { once: true });
    });
  }

  async function callFunction(name, data = {}) {
    const ready = await ensureFunctionsReady();
    if (!ready) {
      throw new Error('Firebase Functions no está disponible');
    }
    if (window.firebaseModular && window.firebaseModular.httpsCallable) {
      const callable = window.firebaseModular.httpsCallable(name);
      const res = await callable(data);
      return res;
    }
    const fb = window.firebase;
    if (fb && typeof fb.functions === 'function') {
      const callable = fb.functions().httpsCallable(name);
      return callable(data);
    }
    throw new Error('Firebase Functions no está disponible');
  }

  function getBackupWarningThreshold() {
    const threshold =
      window.AdminSettingsCache?.security?.backupCodesWarningThreshold;
    const parsed = parseInt(threshold, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 2;
  }

  function setTwoFactorStatus(modalOverlay, message, isError = false) {
    const status = modalOverlay.querySelector('#twoFactorStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  async function getCurrentUser() {
    const fb = window.firebase;
    if (!fb || typeof fb.auth !== 'function') {
      throw new Error('Firebase Auth no está disponible');
    }
    const user = fb.auth().currentUser;
    if (!user) {
      throw new Error('Debes iniciar sesión para configurar 2FA');
    }
    return user;
  }

  async function ensureRecaptcha(modalOverlay) {
    if (modalOverlay.__recaptchaVerifier) {
      return modalOverlay.__recaptchaVerifier;
    }
    const container = modalOverlay.querySelector('#twoFactorRecaptcha');
    if (!container) {
      throw new Error('Contenedor reCAPTCHA no disponible');
    }
    container.innerHTML = '';
    const fb = window.firebase;
    if (!fb || !fb.auth || typeof fb.auth.RecaptchaVerifier !== 'function') {
      throw new Error('reCAPTCHA no está disponible');
    }
    const verifier = new fb.auth.RecaptchaVerifier(container, {
      size: 'invisible',
    });
    modalOverlay.__recaptchaVerifier = verifier;
    return verifier;
  }

  function setToggleState(toggle, isEnabled) {
    if (!toggle) return;
    toggle.checked = Boolean(isEnabled);
    toggle.dataset.enrolled = isEnabled ? '1' : '0';
  }

  function updateTwoFactorCapabilities(modalOverlay) {
    if (!modalOverlay) return;
    const smsSection = modalOverlay.querySelector('#twoFactorSmsSection');
    if (!smsSection) return;
    const fb = window.firebase;
    const smsAvailable = Boolean(
      fb &&
        fb.auth &&
        fb.auth.PhoneAuthProvider &&
        fb.auth.PhoneMultiFactorGenerator
    );
    smsSection.classList.toggle('hidden', !smsAvailable);
  }

  function renderBackupCodes(modalOverlay, codes) {
    const list = modalOverlay.querySelector('#twoFactorBackupList');
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(codes) || codes.length === 0) {
      list.textContent = 'Sin códigos generados.';
      return;
    }
    const fragment = document.createDocumentFragment();
    codes.forEach(code => {
      const chip = document.createElement('span');
      chip.className = 'two-factor-modal__backup-code';
      chip.textContent = code;
      fragment.appendChild(chip);
    });
    list.appendChild(fragment);
    modalOverlay.dataset.backupCodes = JSON.stringify(codes);
  }

  async function syncTwoFactorEnrollment(toggle, modalOverlay) {
    try {
      const user = await getCurrentUser();
      const factors = user.multiFactor?.enrolledFactors || [];
      let enabled = factors.length > 0;

      try {
        const statusResp = await callFunction('getTotpStatus');
        const status = statusResp?.data || {};
        if (status.enabled) {
          enabled = true;
          if (modalOverlay) {
            modalOverlay.dataset.totpEnabled = '1';
          }
          if (
            modalOverlay &&
            typeof status.remainingBackupCodes === 'number'
          ) {
            const statusText = `Códigos de respaldo restantes: ${status.remainingBackupCodes}`;
            setTwoFactorStatus(modalOverlay, statusText);
            const threshold = getBackupWarningThreshold();
            if (
              status.remainingBackupCodes <= threshold &&
              modalOverlay.dataset.autoRotated !== '1'
            ) {
              modalOverlay.dataset.autoRotated = '1';
              notifyTwoFactor(
                'Rotando códigos de respaldo automáticamente...',
                'info'
              );
              await generateBackupCodes(modalOverlay);
            }
          }
        } else if (modalOverlay) {
          modalOverlay.dataset.totpEnabled = '0';
        }
      } catch (err) {
        console.warn('[2FA] No se pudo obtener estado TOTP', err);
      }

      setToggleState(toggle, enabled || toggle.checked);

      if (modalOverlay) {
        if (enabled) {
          const currentStatus = modalOverlay.querySelector('#twoFactorStatus')
            ?.textContent;
          if (!currentStatus) {
            setTwoFactorStatus(
              modalOverlay,
              '2FA ya está activo en esta cuenta.'
            );
          }
        } else {
          setTwoFactorStatus(modalOverlay, '');
        }
      }
    } catch (error) {
      if (modalOverlay) {
        setTwoFactorStatus(modalOverlay, error.message, true);
      }
    }
  }

  async function requestTotpSetup(modalOverlay) {
    try {
      setTwoFactorStatus(modalOverlay, 'Generando QR...');
      const response = await callFunction('generateTotpSecret');
      const data = response?.data || {};
      const qr = modalOverlay.querySelector('#twoFactorTotpQr');
      if (qr && data.qrDataUrl) {
        qr.src = data.qrDataUrl;
        qr.classList.remove('hidden');
      }
      setTwoFactorStatus(
        modalOverlay,
        'QR generado. Escanéalo con tu app.'
      );
    } catch (error) {
      console.error('[2FA] Error generando TOTP', error);
      setTwoFactorStatus(modalOverlay, error.message, true);
    }
  }

  async function verifyTotpEnable(modalOverlay, toggle) {
    const codeInput = modalOverlay.querySelector('#twoFactorTotpCode');
    const code = codeInput ? codeInput.value.trim() : '';
    if (!code) {
      setTwoFactorStatus(modalOverlay, 'Ingresa el código TOTP.', true);
      return;
    }
    try {
      setTwoFactorStatus(modalOverlay, 'Verificando TOTP...');
      await callFunction('verifyTotpAndEnable', { code });
      modalOverlay.dataset.totpEnabled = '1';
      setToggleState(toggle, true);
      setTwoFactorStatus(modalOverlay, 'TOTP activado correctamente.');
      notifyTwoFactor('TOTP activado correctamente', 'success');
      await generateBackupCodes(modalOverlay);
    } catch (error) {
      console.error('[2FA] Error verificando TOTP', error);
      setTwoFactorStatus(modalOverlay, error.message, true);
    }
  }

  async function generateBackupCodes(modalOverlay) {
    try {
      setTwoFactorStatus(modalOverlay, 'Generando códigos de respaldo...');
      const response = await callFunction('generateBackupCodes');
      const codes = response?.data?.codes || [];
      renderBackupCodes(modalOverlay, codes);
      setTwoFactorStatus(
        modalOverlay,
        `Códigos generados. Total: ${codes.length}`
      );
    } catch (error) {
      console.error('[2FA] Error generando backup codes', error);
      setTwoFactorStatus(modalOverlay, error.message, true);
    }
  }

  function downloadBackupCodes(modalOverlay) {
    const raw = modalOverlay.dataset.backupCodes;
    if (!raw) {
      setTwoFactorStatus(
        modalOverlay,
        'Genera los códigos antes de descargarlos.',
        true
      );
      return;
    }
    let codes = [];
    try {
      codes = JSON.parse(raw);
    } catch (_e) {}
    if (!Array.isArray(codes) || codes.length === 0) {
      setTwoFactorStatus(
        modalOverlay,
        'No hay códigos para descargar.',
        true
      );
      return;
    }
    const content = `Códigos de respaldo WifiHackX\n\n${codes.join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wifihackx-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function sendTwoFactorCode(modalOverlay) {
    const phoneInput = modalOverlay.querySelector('#twoFactorPhone');
    const sendBtn = modalOverlay.querySelector('[data-action="sendTwoFactorCode"]');
    if (!phoneInput || !sendBtn) return;

    const phoneNumber = phoneInput.value.trim();
    if (!phoneNumber) {
      setTwoFactorStatus(modalOverlay, 'Ingresa un número válido.', true);
      return;
    }

    try {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
      setTwoFactorStatus(modalOverlay, 'Enviando código SMS...');

      const user = await getCurrentUser();
      const fb = window.firebase;
      if (
        !fb ||
        !fb.auth ||
        !fb.auth.PhoneAuthProvider ||
        !fb.auth.PhoneMultiFactorGenerator
      ) {
        throw new Error('Firebase MFA no está habilitado en este proyecto');
      }

      const session = await user.multiFactor.getSession();
      const verifier = await ensureRecaptcha(modalOverlay);
      const provider = new fb.auth.PhoneAuthProvider();

      const verificationId = await provider.verifyPhoneNumber(
        { phoneNumber, session },
        verifier
      );

      modalOverlay.dataset.verificationId = verificationId;
      setTwoFactorStatus(modalOverlay, 'Código enviado. Revisa tu SMS.');
    } catch (error) {
      console.error('[2FA] Error enviando código', error);
      setTwoFactorStatus(modalOverlay, error.message, true);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Enviar código SMS';
    }
  }

  async function verifyTwoFactorCode(toggle, modalOverlay) {
    const codeInput = modalOverlay.querySelector('#twoFactorCode');
    const verifyBtn = modalOverlay.querySelector('[data-action="verifyTwoFactorCode"]');
    if (!codeInput || !verifyBtn) return;

    const code = codeInput.value.trim();
    const verificationId = modalOverlay.dataset.verificationId;
    if (!verificationId) {
      setTwoFactorStatus(modalOverlay, 'Primero solicita un código SMS.', true);
      return;
    }
    if (!code) {
      setTwoFactorStatus(modalOverlay, 'Ingresa el código recibido.', true);
      return;
    }

    try {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verificando...';
      setTwoFactorStatus(modalOverlay, 'Verificando código...');

      const user = await getCurrentUser();
      const fb = window.firebase;
      if (!fb || !fb.auth || !fb.auth.PhoneMultiFactorGenerator) {
        throw new Error('Firebase MFA no está habilitado en este proyecto');
      }
      const cred = fb.auth.PhoneMultiFactorGenerator.credential(
        verificationId,
        code
      );
      await user.multiFactor.enroll(cred, 'SMS');

      setToggleState(toggle, true);
      setTwoFactorStatus(modalOverlay, '2FA activado correctamente.');
      notifyTwoFactor('2FA activado correctamente', 'success');

      setTimeout(() => closeTwoFactorModal(), 800);
    } catch (error) {
      console.error('[2FA] Error verificando código', error);
      setTwoFactorStatus(modalOverlay, error.message, true);
      setToggleState(toggle, false);
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verificar y activar';
    }
  }

  async function disableTwoFactor(toggle) {
    try {
      const user = await getCurrentUser();
      const factors = user.multiFactor?.enrolledFactors || [];

      const confirmed = confirm(
        '¿Quieres desactivar la autenticación de dos factores? Esta acción reduce la seguridad.'
      );
      if (!confirmed) {
        setToggleState(toggle, true);
        return;
      }

      if (factors.length > 0) {
        await Promise.all(
          factors.map(factor => user.multiFactor.unenroll(factor.uid))
        );
      }

      try {
        await callFunction('disableTotp');
      } catch (err) {
        console.warn('[2FA] No se pudo desactivar TOTP', err);
      }
      setToggleState(toggle, false);
      notifyTwoFactor('2FA desactivado correctamente', 'success');
    } catch (error) {
      console.error('[2FA] Error desactivando', error);
      notifyTwoFactor(error.message || 'Error al desactivar 2FA', 'error');
      setToggleState(toggle, true);
    }
  }

  function setupTwoFactorModal() {
    const toggle = document.getElementById('setting2FA');
    if (!toggle) return;

    if (toggle.dataset.twoFactorListener === '1') {
      return;
    }
    toggle.dataset.twoFactorListener = '1';

    const openIfChecked = () => {
      if (!toggle.checked) return;
      const modal = document.getElementById(TWO_FACTOR_MODAL_ID);
      if (!modal || !modal.classList.contains('active')) {
        openTwoFactorModal(toggle);
      }
    };

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        openIfChecked();
      } else {
        await disableTwoFactor(toggle);
      }
    });

    // Defensive: some browsers update checkbox state after click/keyup.
    const scheduleOpen = () => setTimeout(openIfChecked, 0);
    toggle.addEventListener('click', scheduleOpen);
    toggle.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') scheduleOpen();
    });

    const modalOverlay = ensureTwoFactorModal();
    syncTwoFactorEnrollment(toggle, modalOverlay);
    if (modalOverlay.dataset.listenersBound === '1') return;
    modalOverlay.dataset.listenersBound = '1';

    modalOverlay.addEventListener('click', event => {
      if (event.target === modalOverlay) {
        closeTwoFactorModal({ revertToggle: true });
      }
    });

    const cancelBtn = modalOverlay.querySelector(
      '[data-action="cancelTwoFactor"]'
    );
    const sendBtn = modalOverlay.querySelector(
      '[data-action="sendTwoFactorCode"]'
    );
    const verifyBtn = modalOverlay.querySelector(
      '[data-action="verifyTwoFactorCode"]'
    );
    const totpSetupBtn = modalOverlay.querySelector(
      '[data-action="requestTotpSetup"]'
    );
    const totpVerifyBtn = modalOverlay.querySelector(
      '[data-action="verifyTotpEnable"]'
    );
    const backupGenerateBtn = modalOverlay.querySelector(
      '[data-action="generateBackupCodes"]'
    );
    const backupDownloadBtn = modalOverlay.querySelector(
      '[data-action="downloadBackupCodes"]'
    );
    const closeBtn = modalOverlay.querySelector('.two-factor-modal__close');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () =>
        closeTwoFactorModal({ revertToggle: true })
      );
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => sendTwoFactorCode(modalOverlay));
    }

    if (verifyBtn) {
      verifyBtn.addEventListener('click', () =>
        verifyTwoFactorCode(toggle, modalOverlay)
      );
    }

    if (totpSetupBtn) {
      totpSetupBtn.addEventListener('click', () =>
        requestTotpSetup(modalOverlay)
      );
    }

    if (totpVerifyBtn) {
      totpVerifyBtn.addEventListener('click', () =>
        verifyTotpEnable(modalOverlay, toggle)
      );
    }

    if (backupGenerateBtn) {
      backupGenerateBtn.addEventListener('click', () =>
        generateBackupCodes(modalOverlay)
      );
    }

    if (backupDownloadBtn) {
      backupDownloadBtn.addEventListener('click', () =>
        downloadBackupCodes(modalOverlay)
      );
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () =>
        closeTwoFactorModal({ revertToggle: true })
      );
    }

    // Fallback global: algunos flujos de render/rehidratación pueden perder
    // listeners del toggle local. Este respaldo asegura apertura del modal.
    if (document.body && document.body.dataset.twoFactorGlobalBound !== '1') {
      document.body.dataset.twoFactorGlobalBound = '1';

      const openFromTarget = target => {
        if (!target || target.id !== 'setting2FA') return;
        if (!target.checked) return;
        try {
          openTwoFactorModal(target);
        } catch (error) {
          console.error('[2FA] Fallback global: no se pudo abrir modal', error);
          const overlay = document.getElementById(TWO_FACTOR_MODAL_ID);
          if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-hidden', 'false');
          }
        }
      };

      document.addEventListener('change', event => {
        openFromTarget(event.target);
      });

      document.addEventListener('click', event => {
        const actionBtn = event.target?.closest?.('[data-action="openTwoFactorConfig"]');
        if (actionBtn) {
          const target = document.getElementById('setting2FA');
          if (target) target.checked = true;
          try {
            openTwoFactorModal(target || null);
          } catch (error) {
            console.error('[2FA] Fallback global botón: no se pudo abrir modal', error);
            const overlay = document.getElementById(TWO_FACTOR_MODAL_ID);
            if (overlay) {
              overlay.classList.add('active');
              overlay.style.display = 'flex';
              overlay.setAttribute('aria-hidden', 'false');
            }
          }
          return;
        }

        const target =
          event.target?.id === 'setting2FA'
            ? event.target
            : event.target?.closest?.('#setting2FA');
        if (!target) return;
        setTimeout(() => openFromTarget(target), 0);
      });
    }
  }

  /**
   * Inicializar cuando el DOM esté listo
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderSettingsCards);
    } else {
      renderSettingsCards();
    }
  }

  // Exponer función globalmente para uso externo si es necesario
  window.SettingsCardsGenerator = {
    render: renderSettingsCards,
    config: SETTINGS_CARDS_CONFIG,
    openTwoFactorModal: () => {
      const toggle = document.getElementById('setting2FA');
      if (!toggle) return;
      toggle.checked = true;
      openTwoFactorModal(toggle);
    },
  };

  // Inicializar
  init();
}

export function initSettingsCardsGenerator() {
  if (window.__SETTINGS_CARDS_GENERATOR_INITED__) {
    return;
  }

  window.__SETTINGS_CARDS_GENERATOR_INITED__ = true;
  setupSettingsCardsGenerator();
}

if (typeof window !== 'undefined' && !window.__SETTINGS_CARDS_GENERATOR_NO_AUTO__) {
  initSettingsCardsGenerator();
}
