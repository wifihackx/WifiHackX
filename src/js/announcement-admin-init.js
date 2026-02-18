/**
 * Announcement Admin Initialization
 * Inicializa el sistema de administración de anuncios
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupAnnouncementAdminInit() {
  let templateListenerBound = false;
  let formRetryAttempts = 0;
  const MAX_FORM_RETRY_ATTEMPTS = 50;

  /**
   * Inicializar el FormHandler
   */
  function initFormHandler() {
    if (window.announcementFormHandler) {
      debugLog('[AnnouncementAdminInit] FormHandler ya inicializado');
      return;
    }

    if (!window.AnnouncementFormHandler) {
      console.warn(
        '[AnnouncementAdminInit] AnnouncementFormHandler class not available yet'
      );
      return;
    }

    try {
      // Obtener DataManager (preferir SafeAdminDataManager si existe)
      const DataManagerRef =
        window.SafeAdminDataManager || window.AdminDataManager;
      if (!DataManagerRef) {
        console.warn(
          '[AnnouncementAdminInit] AdminDataManager not available yet'
        );
        return;
      }

      // Crear instancia si es clase, o usar objeto si ya viene instanciado
      const dataManager =
        typeof DataManagerRef === 'function'
          ? new DataManagerRef()
          : DataManagerRef;

      debugLog(
        '[AnnouncementAdminInit] Using AdminDataManager instance:',
        typeof dataManager
      );
      window.announcementFormHandler = new window.AnnouncementFormHandler(
        dataManager
      );

      // Inicializar con el formulario
      const formInitialized =
        window.announcementFormHandler.initialize('announcementForm');

      if (formInitialized) {
        debugLog(
          '[AnnouncementAdminInit] FormHandler inicializado correctamente'
        );
      } else {
        console.warn(
          '[AnnouncementAdminInit] FormHandler initialization returned false'
        );
      }
    } catch (error) {
      console.error(
        '[AnnouncementAdminInit] Error inicializando FormHandler:',
        error
      );
    }
  }

  /**
   * Esperar a que todo esté listo
   */
  function waitForDependencies() {
    const formEl = document.getElementById('announcementForm');
    if (!formEl) {
      const adminView = document.getElementById('adminView');
      const templateLoaded = adminView?.dataset?.templateLoaded === '1';
      if (!templateListenerBound) {
        templateListenerBound = true;
        const onTemplateReady = () => {
          templateListenerBound = false;
          waitForDependencies();
        };
        window.addEventListener('adminView:templateLoaded', onTemplateReady, {
          once: true,
        });
        window.addEventListener('adminTemplateLoaded', onTemplateReady, {
          once: true,
        });
      }
      if (templateLoaded && formRetryAttempts < MAX_FORM_RETRY_ATTEMPTS) {
        formRetryAttempts += 1;
        setTimeout(waitForDependencies, 150);
      }
      return;
    }
    formRetryAttempts = 0;

    let isInitialized = false;
    let checks = 0;
    const MAX_CHECKS = 50;

    const checkInterval = setInterval(() => {
      checks += 1;
      const hasFormHandler = !!window.AnnouncementFormHandler;
      const hasDataManager = !!(
        window.SafeAdminDataManager || window.AdminDataManager
      );
      const hasForm = !!formEl;

      if (hasFormHandler && hasDataManager && hasForm) {
        clearInterval(checkInterval);
        isInitialized = true;
        initFormHandler();
        return;
      }

      if (checks >= MAX_CHECKS) {
        clearInterval(checkInterval);
      }
    }, 100);

    // Fallback silencioso: cortar polling si no aparece todo a tiempo.
    setTimeout(() => {
      if (!isInitialized) {
        clearInterval(checkInterval);
      }
    }, 10000);
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDependencies);
  } else {
    waitForDependencies();
  }

}

export function initAnnouncementAdminInit() {
  if (window.__ANNOUNCEMENT_ADMIN_INIT_INITED__) {
    return;
  }

  window.__ANNOUNCEMENT_ADMIN_INIT_INITED__ = true;
  setupAnnouncementAdminInit();
}

if (typeof window !== 'undefined' && !window.__ANNOUNCEMENT_ADMIN_INIT_NO_AUTO__) {
  initAnnouncementAdminInit();
}

