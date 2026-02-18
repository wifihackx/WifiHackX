/**
 * SettingsController - Gestión de configuraciones del sistema
 *
 * Este módulo maneja la configuración del sistema admin, permitiendo
 * cargar, editar y guardar configuraciones en Firebase.
 *
 * @class SettingsController
 * @requires AdminController
 * @requires Firebase Firestore
 */

class SettingsController {
  /**
   * Constructor del SettingsController
   * @param {AdminController} adminController - Instancia del controlador principal
   */
  constructor(adminController) {
    this.admin = adminController;
    this.settings = {};
    this._autoSaveTimer = null;
    this._isSaving = false;
    this._saveStatusEl = null;
    this._saveBtn = null;
    this._resetBtn = null;
    this._isReady = false;
    this.defaultSettings = {
      general: {
        siteName: 'WifiHackX',
        contactEmail: '',
        maintenanceMode: false,
        adminInfoNotifications: false,
        adminStrictNotifications: true,
      },
      security: {
        twoFactorAuth: true,
        sessionTimeout: 30,
        securityLogs: true,
        backupCodesWarningThreshold: 2,
        adminAllowlistEmails: '',
        adminAllowlistUids: '',
        blockedRegistrationEmailDomains: '',
      },
      email: {
        smtpServer: '',
        smtpPort: '',
        emailNotifications: false,
      },
    };
    this.settingsDocId = 'system-config';
  }

  normalizeSettings(input) {
    const base = this.defaultSettings || {};
    const src = input || {};
    return {
      general: {
        ...base.general,
        ...(src.general || {}),
      },
      security: {
        ...base.security,
        ...(src.security || {}),
      },
      email: {
        ...base.email,
        ...(src.email || {}),
      },
      updatedAt: src.updatedAt || base.updatedAt,
      updatedBy: src.updatedBy || base.updatedBy,
    };
  }

  /**
   * Carga la sección de configuración
   * @returns {Promise<void>}
   */
  async load() {
    try {
      console.log('[SettingsController] Cargando configuración...');

      if (!window.firebaseModular?.db && !window.db) {
        await this.waitForFirebase();
      }
      const hasUser = await this.waitForAuth();
      if (!hasUser) {
        this._isReady = false;
        this.setSaveStatus('Inicia sesión para cargar configuraciones', 'pending');
        if (!this._authPendingInit && (window.auth || window.firebaseModular?.auth)) {
          this._authPendingInit = true;
          const auth = window.auth || window.firebaseModular?.auth;
          if (auth?.onAuthStateChanged) {
            auth.onAuthStateChanged(user => {
              if (user) {
                this._authPendingInit = false;
                this.load().catch(() => {});
              }
            });
          }
        }
        return;
      }

      // Cargar configuraciones desde Firebase
      await this.loadSettings();

      // Asegurar que el formulario esté renderizado antes de pintar valores
      await this.ensureSettingsFormReady();

      // Renderizar configuraciones en el formulario
      this.renderSettings();

      // Configurar event listeners
      this.setupEventListeners();

      // Verificar permisos de admin (custom claim)
      const isAdmin = await this.verifyAdminClaims();
      if (isAdmin) {
        await this.checkRegistrationGuardHealth();
      }

      console.log('[SettingsController] Configuración cargada exitosamente');
    } catch (error) {
      console.error(
        '[SettingsController] Error al cargar configuración:',
        error
      );
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Configuración');
      }
    }
  }

  async ensureSettingsFormReady() {
    const hasInputs = () =>
      !!document.getElementById('settingSiteName') &&
      !!document.getElementById('settingContactEmail');

    if (hasInputs()) return;

    if (window.SettingsCardsGenerator && window.SettingsCardsGenerator.render) {
      window.SettingsCardsGenerator.render();
    }

    const maxWaitMs = 3000;
    const start = Date.now();
    while (!hasInputs() && Date.now() - start < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }

  async waitForFirebase(maxWaitMs = 4000) {
    if (window.firebaseModular?.db || window.db) return true;
    await new Promise(resolve => {
      const handler = () => {
        window.removeEventListener('firebase:initialized', handler);
        window.removeEventListener('firebaseReady', handler);
        resolve();
      };
      window.addEventListener('firebase:initialized', handler, { once: true });
      window.addEventListener('firebaseReady', handler, { once: true });
      setTimeout(resolve, maxWaitMs);
    });
    return !!(window.firebaseModular?.db || window.db);
  }

  async waitForAuth(maxWaitMs = 6000) {
    const auth = window.auth || window.firebaseModular?.auth;
    if (!auth) return false;
    if (auth.currentUser) return true;
    await new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, maxWaitMs);
      const unsub = auth.onAuthStateChanged
        ? auth.onAuthStateChanged(() => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (typeof unsub === 'function') unsub();
            resolve();
          })
        : null;
      // Safety: if no onAuthStateChanged, just wait for timer.
      if (!auth.onAuthStateChanged) {
        clearTimeout(timer);
        resolve();
      }
    });
    return !!(auth.currentUser);
  }

  /**
   * Carga las configuraciones desde Firestore
   * @returns {Promise<void>}
   */
  async loadSettings() {
    try {
      if (!window.firebaseModular?.db && !window.db) {
        await this.waitForFirebase();
      }
      const hasUser = await this.waitForAuth();
      if (!hasUser) {
        this.settings = { ...this.defaultSettings };
        return;
      }
      if (!window.AdminSettingsService?.getSettings) {
        await new Promise(resolve => {
          const handler = () => {
            window.removeEventListener('admin:services-ready', handler);
            resolve();
          };
          window.addEventListener('admin:services-ready', handler, { once: true });
          setTimeout(resolve, 3000);
        });
      }
      if (!window.AdminSettingsService?.getSettings) {
        throw new Error('AdminSettingsService no disponible');
      }
      const data = await window.AdminSettingsService.getSettings({
        allowDefault: true,
      });
      if (data) {
        this.settings = this.normalizeSettings(data);
        if (typeof window !== 'undefined') {
          window.AdminSettingsCache = this.settings;
        }
        return;
      }

      // Si no existen configuraciones, usar defaults
      this.settings = { ...this.defaultSettings };
      console.log('[SettingsController] Usando configuraciones por defecto');
      if (typeof window !== 'undefined') {
        window.AdminSettingsCache = this.settings;
      }
    } catch (error) {
      if (!window.auth?.currentUser) {
        this.settings = { ...this.defaultSettings };
        return;
      }
      const isAuthIssue =
        error?.code === 'permission-denied' || error?.code === 'unauthenticated';
      const logFn = isAuthIssue ? console.warn : console.error;
      logFn('[SettingsController] Error al cargar configuraciones:', error);
      if (
        typeof DOMUtils !== 'undefined' &&
        DOMUtils.showNotification &&
        error?.code === 'permission-denied'
      ) {
        DOMUtils.showNotification(
          'Sin permisos para leer configuraciones (admin claim requerido)',
          'error'
        );
      }
      // Usar defaults si hay error
      this.settings = { ...this.defaultSettings };
      throw error;
    }
  }

  /**
   * Renderiza las configuraciones en el formulario
   */
  renderSettings() {
    try {
      const settingsSection = document.getElementById('settingsSection');
      if (!settingsSection) {
        console.error(
          '[SettingsController] Sección de configuración no encontrada'
        );
        return;
      }
      const hasData =
        !!this.settings?.general?.siteName ||
        !!this.settings?.general?.contactEmail ||
        !!this.settings?.email?.smtpServer ||
        !!this.settings?.security?.adminAllowlistEmails ||
        !!this.settings?.security?.adminAllowlistUids ||
        !!this.settings?.security?.blockedRegistrationEmailDomains ||
        !!this.settings?.updatedAt;

      const shouldSetValue = (input, value) => {
        if (!input) return false;
        if (value === undefined || value === null) return false;
        if (value === '' && input.value) return false;
        if (!hasData && input.value) return false;
        return true;
      };

      // Configuración General
      const siteNameInput = document.getElementById('settingSiteName');
      const emailInput = document.getElementById('settingContactEmail');
      const maintenanceToggle = document.getElementById(
        'settingMaintenanceMode'
      );
      const adminInfoNotificationsToggle = document.getElementById(
        'settingAdminInfoNotifications'
      );
      const adminStrictNotificationsToggle = document.getElementById(
        'settingAdminStrictNotifications'
      );

      if (siteNameInput && this.settings.general && shouldSetValue(siteNameInput, this.settings.general.siteName || '')) {
        siteNameInput.value = this.settings.general.siteName || '';
      }
      if (emailInput && this.settings.general && shouldSetValue(emailInput, this.settings.general.contactEmail || '')) {
        emailInput.value = this.settings.general.contactEmail || '';
      }
      if (maintenanceToggle && this.settings.general && (hasData || maintenanceToggle.checked === false)) {
        maintenanceToggle.checked =
          this.settings.general.maintenanceMode || false;
      }
      if (
        adminInfoNotificationsToggle &&
        this.settings.general &&
        (hasData || adminInfoNotificationsToggle.checked === false)
      ) {
        adminInfoNotificationsToggle.checked =
          this.settings.general.adminInfoNotifications || false;
      }
      if (
        adminStrictNotificationsToggle &&
        this.settings.general &&
        (hasData || adminStrictNotificationsToggle.checked === false)
      ) {
        adminStrictNotificationsToggle.checked =
          this.settings.general.adminStrictNotifications !== false;
      }

      // Configuración de Seguridad
      const securityTwoFactor = document.getElementById('setting2FA');
      const securityLogsToggle = document.getElementById('settingSecurityLogs');
      const sessionTimeoutInput = document.getElementById(
        'settingSessionTimeout'
      );
      const backupThresholdInput = document.getElementById(
        'settingBackupCodesThreshold'
      );
      const adminAllowlistEmailsInput = document.getElementById(
        'settingAdminAllowlistEmails'
      );
      const adminAllowlistUidsInput = document.getElementById(
        'settingAdminAllowlistUids'
      );
      const blockedRegistrationDomainsInput = document.getElementById(
        'settingBlockedRegistrationDomains'
      );

      if (this.settings.security) {
        if (securityTwoFactor)
          securityTwoFactor.checked =
            hasData ? (this.settings.security.twoFactorAuth || false) : securityTwoFactor.checked;
        if (securityLogsToggle)
          securityLogsToggle.checked =
            hasData ? (this.settings.security.securityLogs || false) : securityLogsToggle.checked;
      }
      if (sessionTimeoutInput && this.settings.security && shouldSetValue(sessionTimeoutInput, this.settings.security.sessionTimeout)) {
        sessionTimeoutInput.value = this.settings.security.sessionTimeout || 30;
      }
      if (backupThresholdInput && this.settings.security && shouldSetValue(backupThresholdInput, this.settings.security.backupCodesWarningThreshold)) {
        backupThresholdInput.value =
          this.settings.security.backupCodesWarningThreshold || 2;
      }
      if (adminAllowlistEmailsInput && this.settings.security && shouldSetValue(adminAllowlistEmailsInput, this.settings.security.adminAllowlistEmails || '')) {
        adminAllowlistEmailsInput.value =
          this.settings.security.adminAllowlistEmails || '';
      }
      if (adminAllowlistUidsInput && this.settings.security && shouldSetValue(adminAllowlistUidsInput, this.settings.security.adminAllowlistUids || '')) {
        adminAllowlistUidsInput.value =
          this.settings.security.adminAllowlistUids || '';
      }
      if (blockedRegistrationDomainsInput && this.settings.security && shouldSetValue(blockedRegistrationDomainsInput, this.settings.security.blockedRegistrationEmailDomains || '')) {
        blockedRegistrationDomainsInput.value =
          this.settings.security.blockedRegistrationEmailDomains || '';
      }

      // Configuración de Email
      if (this.settings.email) {
        const smtpServerInput = document.getElementById('settingSmtpServer');
        const smtpPortInput = document.getElementById('settingSmtpPort');
        const emailNotificationsToggle = document.getElementById(
          'settingEmailNotifications'
        );

        if (smtpServerInput && shouldSetValue(smtpServerInput, this.settings.email.smtpServer || ''))
          smtpServerInput.value = this.settings.email.smtpServer || '';
        if (smtpPortInput) {
          const smtpPortValue = this.settings.email.smtpPort;
          if (shouldSetValue(smtpPortInput, smtpPortValue)) {
            smtpPortInput.value =
              smtpPortValue !== undefined && smtpPortValue !== null
                ? String(smtpPortValue)
                : '';
          }
        }
        if (emailNotificationsToggle)
          emailNotificationsToggle.checked =
            hasData ? (this.settings.email.emailNotifications || false) : emailNotificationsToggle.checked;
      }

      console.log(
        '[SettingsController] Configuraciones renderizadas en el formulario'
      );
      this._isReady = true;
      this.setSaveStatus('Listo', 'idle');
    } catch (error) {
      console.error(
        '[SettingsController] Error al renderizar configuraciones:',
        error
      );
    }
  }

  /**
   * Configura los event listeners para los botones
   */
  setupEventListeners() {
    const settingsSection = document.getElementById('settingsSection');
    if (!settingsSection) return;
    this._saveStatusEl = document.getElementById('settingsSaveStatus');

    // Botón Guardar Cambios
    const saveBtn = settingsSection.querySelector(
      '[data-action="saveSettings"]'
    );
    this._saveBtn = saveBtn || null;
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.updateSettings());
    }

    // Botón Restaurar Defaults
    const resetBtn = settingsSection.querySelector(
      '[data-action="resetSettings"]'
    );
    this._resetBtn = resetBtn || null;
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSettings());
    }

    settingsSection.addEventListener('click', event => {
      const trigger = event.target?.closest?.(
        '[data-action="testRegistrationGuard"]'
      );
      if (!trigger) return;
      event.preventDefault();
      this.runRegistrationGuardTest().catch(error =>
        console.warn('[SettingsController] Test anti-bot falló:', error)
      );
    });

    settingsSection.addEventListener('click', event => {
      const trigger = event.target?.closest?.(
        '[data-action="loadRegistrationGuardStats"]'
      );
      if (!trigger) return;
      event.preventDefault();
      this.loadRegistrationGuardStats().catch(error =>
        console.warn('[SettingsController] Stats anti-bot fallaron:', error)
      );
    });

    const debouncedAutoSave = () => {
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
      }
      this.setSaveStatus('Cambios pendientes', 'pending');
      this._autoSaveTimer = setTimeout(() => {
        this.updateSettings({
          silent: true,
          source: 'autosave',
          allowIncomplete: true,
        });
      }, 800);
    };

    settingsSection.addEventListener('change', event => {
      const target = event.target;
      if (!target || !target.matches('input, select, textarea')) return;
      if (target.closest('.settings-actions')) return;
      if (target.type === 'text' || target.type === 'email' || target.type === 'number' || target.tagName === 'TEXTAREA') {
        return;
      }
      debouncedAutoSave();
    });

    settingsSection.addEventListener(
      'blur',
      event => {
        const target = event.target;
        if (!target || !target.matches('input, select, textarea')) return;
        if (target.closest('.settings-actions')) return;
        if (target.type === 'checkbox') return;
        debouncedAutoSave();
      },
      true
    );

    console.log('[SettingsController] Event listeners configurados');
  }

  /**
   * Actualiza las configuraciones desde el formulario
   * @returns {Promise<void>}
   */
  async updateSettings(options = {}) {
    try {
      if (!this._isReady && options.source === 'autosave') {
        return;
      }
      await this.ensureSettingsFormReady();
      if (!this.settings || !this.settings.general || Object.keys(this.settings.general).length === 0) {
        try {
          await this.loadSettings();
          this.renderSettings();
        } catch (_) {
          // ignore
        }
      }
      if (!(await this.verifyAdminClaims())) {
        this.setSaveStatus('Permiso admin requerido', 'error');
        return;
      }
      if (this._isSaving) return;
      this._isSaving = true;
      this.setSaveStatus('Guardando...', 'saving');
      console.log('[SettingsController] Actualizando configuraciones...');

      // Leer valores del formulario
      const settingsSection = document.getElementById('settingsSection');
      if (!settingsSection) {
        throw new Error('Sección de configuración no encontrada');
      }

      // Configuración General
      const siteNameInput = document.getElementById('settingSiteName');
      const emailInput = document.getElementById('settingContactEmail');
      const maintenanceToggle = document.getElementById('settingMaintenanceMode');
      if (!siteNameInput && !emailInput) {
        this.setSaveStatus('Formulario no listo', 'error');
        return;
      }

      const siteNameValue = siteNameInput?.value?.trim();
      const contactEmailValue = emailInput?.value?.trim();
      const adminInfoNotificationsToggle = document.getElementById(
        'settingAdminInfoNotifications'
      );
      const adminStrictNotificationsToggle = document.getElementById(
        'settingAdminStrictNotifications'
      );
      const generalPayload = {
        siteName: siteNameValue || this.settings.general?.siteName || '',
        contactEmail:
          contactEmailValue || this.settings.general?.contactEmail || '',
        maintenanceMode: maintenanceToggle?.checked || false,
        adminInfoNotifications: adminInfoNotificationsToggle?.checked || false,
        adminStrictNotifications:
          adminStrictNotificationsToggle?.checked !== false,
      };

      // Configuración de Seguridad
      const securityTwoFactor = document.getElementById('setting2FA');
      const securityLogsToggle = document.getElementById('settingSecurityLogs');
      const sessionTimeoutInput = document.getElementById(
        'settingSessionTimeout'
      );
      const backupThresholdInput = document.getElementById(
        'settingBackupCodesThreshold'
      );
      const adminAllowlistEmailsInput = document.getElementById(
        'settingAdminAllowlistEmails'
      );
      const adminAllowlistUidsInput = document.getElementById(
        'settingAdminAllowlistUids'
      );
      const blockedRegistrationDomainsInput = document.getElementById(
        'settingBlockedRegistrationDomains'
      );

      const securityPayload = {
        twoFactorAuth: securityTwoFactor?.checked || false,
        sessionTimeout: parseInt(sessionTimeoutInput?.value) || 30,
        securityLogs: securityLogsToggle?.checked || false,
        backupCodesWarningThreshold:
          parseInt(backupThresholdInput?.value) || 2,
        adminAllowlistEmails: adminAllowlistEmailsInput?.value || '',
        adminAllowlistUids: adminAllowlistUidsInput?.value || '',
        blockedRegistrationEmailDomains:
          blockedRegistrationDomainsInput?.value || '',
      };

      // Configuración de Email
      const smtpServerInput = document.getElementById('settingSmtpServer');
      const smtpPortInput = document.getElementById('settingSmtpPort');
      const emailNotificationsToggle = document.getElementById(
        'settingEmailNotifications'
      );

      const smtpServerValue = smtpServerInput?.value?.trim();
      const smtpPortValue = parseInt(smtpPortInput?.value, 10);
      const emailNotifications =
        emailNotificationsToggle?.checked || false;
      const hasSmtp =
        !!smtpServerValue && Number.isFinite(smtpPortValue);
      const emailPayload = {
        smtpServer: smtpServerValue || this.settings.email?.smtpServer || '',
        smtpPort: Number.isFinite(smtpPortValue)
          ? smtpPortValue
          : this.settings.email?.smtpPort ?? '',
        emailNotifications: emailNotifications && hasSmtp,
      };
      if (emailNotifications && !hasSmtp) {
        if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
          DOMUtils.showNotification(
            'SMTP incompleto: notificaciones por email desactivadas',
            'warning'
          );
        }
      }

      const payloadSnapshot = {
        general: {
          siteName: generalPayload.siteName || '',
          contactEmail: generalPayload.contactEmail || '',
          maintenanceMode: !!generalPayload.maintenanceMode,
          adminInfoNotifications: !!generalPayload.adminInfoNotifications,
          adminStrictNotifications: !!generalPayload.adminStrictNotifications,
        },
        security: {
          twoFactorAuth: !!securityPayload.twoFactorAuth,
          sessionTimeout: Number(securityPayload.sessionTimeout) || 30,
          securityLogs: !!securityPayload.securityLogs,
          backupCodesWarningThreshold:
            Number(securityPayload.backupCodesWarningThreshold) || 2,
          adminAllowlistEmails: securityPayload.adminAllowlistEmails || '',
          adminAllowlistUids: securityPayload.adminAllowlistUids || '',
          blockedRegistrationEmailDomains:
            securityPayload.blockedRegistrationEmailDomains || '',
        },
        email: {
          smtpServer: emailPayload.smtpServer || '',
          smtpPort:
            Number.isFinite(emailPayload.smtpPort) ? emailPayload.smtpPort : '',
          emailNotifications: !!emailPayload.emailNotifications,
        },
      };

      const isPayloadEmpty =
        !payloadSnapshot.general.siteName &&
        !payloadSnapshot.general.contactEmail &&
        !payloadSnapshot.email.smtpServer &&
        payloadSnapshot.email.smtpPort === '' &&
        !payloadSnapshot.email.emailNotifications;
      if (isPayloadEmpty && options.allowIncomplete) {
        this.setSaveStatus('Completa los campos requeridos', 'pending');
        return;
      }

      // Validar configuraciones
      const validation = this.validateSettings({
        settings: payloadSnapshot,
        silent: options.silent,
        allowIncomplete: options.allowIncomplete,
      });
      if (!validation.ok) {
        const message =
          validation.message || 'Completa los campos requeridos';
        if (options.allowIncomplete) {
          this.setSaveStatus(message, 'pending');
          return;
        }
        this.setSaveStatus(message, 'error');
        if (!options.silent && typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
          DOMUtils.showNotification(message, 'error');
        }
        return;
      }

      // Guardar en Firebase (preferir SDK modular para evitar shim vacío)
      const directPayload = {
        general: {
          siteName: siteNameValue || '',
          contactEmail: contactEmailValue || '',
          maintenanceMode: maintenanceToggle?.checked || false,
          adminInfoNotifications: adminInfoNotificationsToggle?.checked || false,
          adminStrictNotifications:
            adminStrictNotificationsToggle?.checked !== false,
        },
        security: {
          twoFactorAuth: securityTwoFactor?.checked || false,
          sessionTimeout: parseInt(sessionTimeoutInput?.value, 10) || 30,
          securityLogs: securityLogsToggle?.checked || false,
          backupCodesWarningThreshold:
            parseInt(backupThresholdInput?.value, 10) || 2,
          adminAllowlistEmails: adminAllowlistEmailsInput?.value || '',
          adminAllowlistUids: adminAllowlistUidsInput?.value || '',
          blockedRegistrationEmailDomains:
            blockedRegistrationDomainsInput?.value || '',
        },
        email: {
          smtpServer: smtpServerValue || '',
          smtpPort: Number.isFinite(smtpPortValue) ? smtpPortValue : '',
          emailNotifications: emailNotifications && hasSmtp,
        },
      };
      if (!window.AdminSettingsService?.saveSettings) {
        throw new Error('AdminSettingsService no disponible');
      }
      await window.AdminSettingsService.saveSettings(directPayload);
      this.settings = this.normalizeSettings(directPayload);

      // Releer para confirmar persistencia
      try {
        const modular = window.firebaseModular;
        if (modular?.db && modular?.doc && (modular.getDocFromServer || modular.getDoc)) {
          const confirmRef = modular.doc(modular.db, 'settings', this.settingsDocId);
          const confirmSnap = modular.getDocFromServer
            ? await modular.getDocFromServer(confirmRef)
            : await modular.getDoc(confirmRef);
          const confirmExists =
            typeof confirmSnap.exists === 'function'
              ? confirmSnap.exists()
              : !!confirmSnap.exists;
          if (!confirmExists) {
            console.warn('[SettingsController] Confirmación guardado: doc vacío');
          }
        } else if (window.db) {
          const confirmDoc = await window.db
            .collection('settings')
            .doc(this.settingsDocId)
            .get();
          const confirmExists = typeof confirmDoc.exists === 'function' ? confirmDoc.exists() : !!confirmDoc.exists;
          if (!confirmExists) {
            console.warn('[SettingsController] Confirmación guardado: doc vacío');
          }
        }
      } catch (confirmError) {
        console.warn('[SettingsController] Error confirmando guardado:', confirmError);
      }

      // Aplicar configuraciones
      await this.applySettings();

      // Mostrar notificación de éxito
      if (!options.silent && typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification(
          'Configuración guardada exitosamente',
          'success'
        );
      }

      this.setSaveStatus('Guardado', 'saved');
      console.log(
        '[SettingsController] Configuraciones actualizadas exitosamente'
      );
    } catch (error) {
      console.error(
        '[SettingsController] Error al actualizar configuraciones:',
        error
      );
      if (
        !options.silent &&
        typeof DOMUtils !== 'undefined' &&
        DOMUtils.showNotification &&
        error?.code === 'permission-denied'
      ) {
        DOMUtils.showNotification(
          'No tienes permisos para guardar (admin claim requerido)',
          'error'
        );
      }
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Actualización de Configuración');
      } else if (!options.silent && typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification('Error al guardar configuración', 'error');
      }
      this.setSaveStatus('Error al guardar', 'error');
    } finally {
      this._isSaving = false;
    }
  }

  setSaveStatus(text, state = 'idle') {
    if (!this._saveStatusEl) return;
    this._saveStatusEl.textContent = text;
    this._saveStatusEl.classList.remove(
      'is-saving',
      'is-saved',
      'is-error'
    );
    if (state === 'saving') {
      this._saveStatusEl.classList.add('is-saving');
    } else if (state === 'saved') {
      this._saveStatusEl.classList.add('is-saved');
    } else if (state === 'error') {
      this._saveStatusEl.classList.add('is-error');
    }
  }


  async verifyAdminClaims() {
    try {
      if (!window.firebase || !firebase.auth) return false;
      const user = firebase.auth().currentUser;
      if (!user) return false;
      const claims = window.getAdminClaims
        ? await window.getAdminClaims(user, false)
        : (await user.getIdTokenResult(true)).claims;
      const isAdmin =
        !!claims?.admin ||
        claims?.role === 'admin' ||
        claims?.role === 'super_admin';
      if (!isAdmin) {
        if (this._saveBtn) this._saveBtn.disabled = true;
        if (this._resetBtn) this._resetBtn.disabled = true;
        this.setSaveStatus('Permiso admin requerido', 'error');
      } else {
        if (this._saveBtn) this._saveBtn.disabled = false;
        if (this._resetBtn) this._resetBtn.disabled = false;
      }
      return isAdmin;
    } catch (error) {
      console.warn('[SettingsController] Error verificando claims:', error);
      return false;
    }
  }

  async callFunctionWithFallback(baseName, data = {}) {
    if (!window.firebase?.functions) {
      throw new Error('Firebase Functions no disponible');
    }
    const candidates = [`${baseName}V2`, baseName];
    let lastError = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const fnName = candidates[i];
      try {
        const callable = window.firebase.functions().httpsCallable(fnName);
        const result = await callable(data);
        return result?.data || {};
      } catch (error) {
        lastError = error;
        const code = String(error?.code || '').toLowerCase();
        const msg = String(error?.message || '').toLowerCase();
        const canFallback =
          code.includes('not-found') ||
          code.includes('unimplemented') ||
          msg.includes('not found') ||
          msg.includes('does not exist');
        if (i === candidates.length - 1 || !canFallback) break;
      }
    }
    throw lastError || new Error('Callable no disponible');
  }

  async runRegistrationGuardTest() {
    const statusEl = document.getElementById('registrationGuardTestStatus');
    if (statusEl) statusEl.textContent = 'Probando...';

    const blockedInput = document.getElementById(
      'settingBlockedRegistrationDomains'
    );
    const firstDomain = String(blockedInput?.value || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .find(Boolean);
    const blockedEmail = firstDomain ? `bot@${firstDomain}` : 'bot@mailinator.com';

    const blockedResult = await this.callFunctionWithFallback(
      'preRegisterGuard',
      {
        testMode: true,
        email: blockedEmail,
        website: 'filled-by-bot',
        userAgent: 'HeadlessChrome Test',
      }
    );
    const cleanResult = await this.callFunctionWithFallback('preRegisterGuard', {
      testMode: true,
      email: 'valid.user@example.com',
      website: '',
      userAgent: 'Mozilla/5.0',
    });

    const blockedReasons = Array.isArray(blockedResult?.reasons)
      ? blockedResult.reasons.join(', ')
      : 'sin motivos';
    const summary = `Bloqueado: ${
      blockedResult?.wouldBlock ? 'si' : 'no'
    } (${blockedReasons}) | Limpio: ${cleanResult?.allowed ? 'si' : 'no'}`;

    if (statusEl) statusEl.textContent = summary;
    if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
      DOMUtils.showNotification('Test anti-bot completado', 'success');
    }
  }

  formatRegistrationStats(stats) {
    const blockedLastHour = Number(stats?.blockedLastHour || 0);
    const blockedLastDay = Number(stats?.blockedLastDay || 0);
    const byReason = stats?.byReason || {};
    const topReasons = Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(' | ');
    return `Bloqueos 1h: ${blockedLastHour} | 24h: ${blockedLastDay}${
      topReasons ? ` | ${topReasons}` : ''
    }`;
  }

  async loadRegistrationGuardStats() {
    const statusEl = document.getElementById('registrationGuardStatsStatus');
    if (statusEl) statusEl.textContent = 'Cargando estadísticas...';
    const stats = await this.callFunctionWithFallback('getRegistrationBlockStats');
    const summary = this.formatRegistrationStats(stats);
    if (statusEl) statusEl.textContent = summary;
    return stats;
  }

  async checkRegistrationGuardHealth() {
    const lastCheckKey = 'adminRegistrationGuardHealthLastCheck';
    const now = Date.now();
    const lastCheck = Number(sessionStorage.getItem(lastCheckKey) || '0');
    if (now - lastCheck < 10 * 60 * 1000) return;
    sessionStorage.setItem(lastCheckKey, String(now));

    try {
      const stats = await this.loadRegistrationGuardStats();
      const blockedLastHour = Number(stats?.blockedLastHour || 0);
      const threshold = Number(stats?.thresholdWarnHour || 10);
      if (blockedLastHour >= threshold) {
        const msg = `Alerta anti-bot: ${blockedLastHour} bloqueos en la última hora`;
        if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
          DOMUtils.showNotification(msg, 'warning');
        } else {
          console.warn(msg);
        }
      }
    } catch (error) {
      console.warn(
        '[SettingsController] No se pudo consultar stats de anti-bot:',
        error
      );
    }
  }

  /**
   * Valida las configuraciones antes de guardar
   * @returns {boolean} True si las configuraciones son válidas
   */
  validateSettings(options = {}) {
    try {
      const settings = this.normalizeSettings(options.settings || this.settings || {});
      const errors = [];
      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!settings.general.contactEmail) {
        errors.push('Email de contacto requerido');
      }
      if (
        settings.general.contactEmail &&
        !emailRegex.test(settings.general.contactEmail)
      ) {
        errors.push('Email de contacto inválido');
      }

      // Validar timeout de sesión
      if (
        settings.security.sessionTimeout < 5 ||
        settings.security.sessionTimeout > 1440
      ) {
        errors.push('Timeout de sesión inválido');
      }
      if (
        settings.security.backupCodesWarningThreshold < 1 ||
        settings.security.backupCodesWarningThreshold > 10
      ) {
        errors.push('Umbral de códigos inválido');
      }
      if (settings.security.adminAllowlistEmails) {
        const emails = settings.security.adminAllowlistEmails
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        const emailRegexList = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalid = emails.find(email => !emailRegexList.test(email));
        if (invalid) {
          errors.push(`Email admin inválido: ${invalid}`);
        }
      }
      if (settings.security.blockedRegistrationEmailDomains) {
        const domains = settings.security.blockedRegistrationEmailDomains
          .split(',')
          .map(item => item.trim().toLowerCase())
          .filter(Boolean);
        const domainRegex = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
        const invalidDomain = domains.find(domain => !domainRegex.test(domain));
        if (invalidDomain) {
          errors.push(`Dominio bloqueado inválido: ${invalidDomain}`);
        }
      }

      // Validar puerto SMTP
      const smtpServer = (settings.email.smtpServer || '').trim();
      const smtpPort = settings.email.smtpPort;
      const requiresSmtp =
        settings.email.emailNotifications || smtpServer || smtpPort;
      if (requiresSmtp) {
        if (!smtpServer) {
          errors.push('Servidor SMTP requerido');
        }
        if (!Number.isFinite(smtpPort)) {
          errors.push('Puerto SMTP inválido');
        }
        if (smtpPort < 1 || smtpPort > 65535) {
          errors.push('Puerto SMTP inválido');
        }
      }

      if (errors.length) {
        if (!options.allowIncomplete && !options.silent) {
          console.warn('[SettingsController] Validación fallida:', errors, settings);
        }
        return { ok: false, message: errors[0], errors };
      }
      return { ok: true };
    } catch (error) {
      console.error(
        '[SettingsController] Error al validar configuraciones:',
        error
      );
      return { ok: false, message: 'Error validando configuraciones' };
    }
  }

  /**
   * Aplica las configuraciones al sistema sin recargar
   * @returns {Promise<void>}
   */
  async applySettings() {
    try {
      console.log('[SettingsController] Aplicando configuraciones...');

      // Aplicar modo mantenimiento
      if (this.settings.general.maintenanceMode) {
        console.log('[SettingsController] Modo mantenimiento activado');
        // Aquí se podría mostrar un banner o mensaje
      }

      // Aplicar timeout de sesión
      if (this.settings.security.sessionTimeout) {
        console.log(
          `[SettingsController] Timeout de sesión: ${this.settings.security.sessionTimeout} minutos`
        );
        // Aquí se podría configurar el timeout real
      }

      // Actualizar título del sitio si cambió
      if (this.settings.general.siteName) {
        const titleElements = document.querySelectorAll('title, .site-name');
        titleElements.forEach(el => {
          if (el.tagName === 'TITLE') {
            el.textContent = this.settings.general.siteName;
          }
        });
      }

      if (typeof window !== 'undefined') {
        window.AdminSettingsCache = this.settings;
        window.dispatchEvent(
          new CustomEvent('admin:settings-updated', {
            detail: this.settings,
          })
        );
      }
      if (typeof window.updateAdminTwoFactorStatus === 'function') {
        window.updateAdminTwoFactorStatus();
      }
      console.log(
        '[SettingsController] Configuraciones aplicadas exitosamente'
      );
    } catch (error) {
      console.error(
        '[SettingsController] Error al aplicar configuraciones:',
        error
      );
    }
  }

  /**
   * Restaura las configuraciones por defecto
   * @returns {Promise<void>}
   */
  async resetSettings() {
    try {
      const confirmed = confirm(
        '¿Estás seguro de que quieres restaurar las configuraciones por defecto? Esta acción no se puede deshacer.'
      );

      if (!confirmed) {
        return;
      }

      console.log(
        '[SettingsController] Restaurando configuraciones por defecto...'
      );

      // Restaurar defaults
      this.settings = { ...this.defaultSettings };

      // Guardar en Firebase
      if (!window.AdminSettingsService?.saveSettings) {
        throw new Error('AdminSettingsService no disponible');
      }
      await window.AdminSettingsService.saveSettings(this.settings);

      // Renderizar en el formulario
      this.renderSettings();

      // Aplicar configuraciones
      await this.applySettings();

      // Mostrar notificación
      if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification(
          'Configuraciones restauradas a valores por defecto',
          'success'
        );
      }

      console.log(
        '[SettingsController] Configuraciones restauradas exitosamente'
      );
    } catch (error) {
      console.error(
        '[SettingsController] Error al restaurar configuraciones:',
        error
      );
      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.handle(error, 'Restauración de Configuración');
      }
    }
  }

  /**
   * Limpia recursos y listeners
   */
  destroy() {
    console.log('[SettingsController] Limpiando recursos...');
    // No hay listeners en tiempo real que limpiar en este caso
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.SettingsController = SettingsController;
}

function setupGlobalSettingsHandlers() {
  if (window.__ADMIN_SETTINGS_GLOBALS_INITED__) {
    return;
  }

  window.__ADMIN_SETTINGS_GLOBALS_INITED__ = true;

  /**
   * Función global para guardar configuraciones
   * Mantiene compatibilidad con código existente
   */
window.saveSettings = async function () {
  try {
    // Buscar instancia del SettingsController en AdminController
    if (
      window.adminController &&
      window.adminController.modules &&
      window.adminController.modules.settings
    ) {
      await window.adminController.modules.settings.updateSettings();
    } else if (
      window.settingsController &&
      typeof window.settingsController.updateSettings === 'function'
    ) {
      await window.settingsController.updateSettings();
    } else if (window.SettingsController) {
      window.settingsController =
        window.settingsController || new window.SettingsController(null);
      if (window.settingsController?.updateSettings) {
        await window.settingsController.updateSettings();
      }
    } else {
      console.warn(
        '[saveSettings] SettingsController no encontrado, usando fallback'
      );
      if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification(
          'No se pudo guardar: módulo de configuración no cargado',
          'error'
        );
      }
    }
    } catch (error) {
      console.error('[saveSettings] Error:', error);
      if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification('Error al guardar configuración', 'error');
      }
    }
  };

  /**
   * Función global para resetear configuraciones
   */
  window.resetSettings = async function () {
  try {
    if (
      window.adminController &&
      window.adminController.modules &&
      window.adminController.modules.settings
    ) {
      await window.adminController.modules.settings.resetSettings();
    } else if (
      window.settingsController &&
      typeof window.settingsController.resetSettings === 'function'
    ) {
      await window.settingsController.resetSettings();
    } else if (window.SettingsController) {
      window.settingsController =
        window.settingsController || new window.SettingsController(null);
      if (window.settingsController?.resetSettings) {
        await window.settingsController.resetSettings();
      }
    } else {
      console.warn('[resetSettings] SettingsController no encontrado');
    }
  } catch (error) {
      console.error('[resetSettings] Error:', error);
    }
  };
}

export function initAdminSettings() {
  if (window.__ADMIN_SETTINGS_INITED__) {
    return;
  }

  window.__ADMIN_SETTINGS_INITED__ = true;
  setupGlobalSettingsHandlers();

  const ensureController = async () => {
    if (!window.firebaseModular && !window.firebase) {
      await new Promise(resolve => {
        const handler = () => {
          window.removeEventListener('firebase:initialized', handler);
          window.removeEventListener('firebaseReady', handler);
          resolve();
        };
        window.addEventListener('firebase:initialized', handler, { once: true });
        window.addEventListener('firebaseReady', handler, { once: true });
        setTimeout(resolve, 4000);
      });
    }
    const settingsSection = document.getElementById('settingsSection');
    if (!settingsSection) return;
    if (!window.settingsController && window.SettingsController) {
      window.settingsController = new window.SettingsController(null);
      if (window.settingsController?.load) {
        await window.settingsController.load();
      }
    }
  };

  window.addEventListener('adminBundleLoaded:settings', () => {
    ensureController().catch(() => {});
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureController().catch(() => {});
    });
  } else {
    ensureController().catch(() => {});
  }
}

