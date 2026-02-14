/**
 * Announcement Admin Initialization
 * Inicializa el sistema de administración de anuncios
 */

'use strict';

function setupAnnouncementAdminInit() {

  console.log(
    '[AnnouncementAdminInit] Inicializando sistema de administración...'
  );

  /**
   * Inicializar el FormHandler
   */
  function initFormHandler() {
    if (window.announcementFormHandler) {
      console.log('[AnnouncementAdminInit] FormHandler ya inicializado');
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

      console.log(
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
        console.log(
          '[AnnouncementAdminInit] FormHandler inicializado correctamente'
        );
        // Wrapper anti-duplicados para el guardado
        if (
          typeof window.handleSaveAnnouncement === 'function' &&
          !window.__saveAnnouncementWrapped
        ) {
          window.__saveAnnouncementWrapped = true;
          const originalHandle = window.handleSaveAnnouncement;
          window.handleSaveAnnouncement = function () {
            // Evitar reentradas rápidas
            if (window.__savingAnnouncement) {
              if (window.NotificationSystem) {
                window.NotificationSystem.warning(
                  'Guardado en progreso, por favor espera...'
                );
              }
              return;
            }
            window.__savingAnnouncement = true;
            const btn = document.querySelector(
              '#announcementsSection [data-action="handleSaveAnnouncement"]'
            );
            if (btn) btn.disabled = true;
            try {
              originalHandle();
            } finally {
              // Rehabilitar tras breve cooldown para evitar múltiples creaciones por eventos duplicados
              setTimeout(() => {
                window.__savingAnnouncement = false;
                if (btn) btn.disabled = false;
              }, 1500);
            }
          };
        }
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
    let isInitialized = false;

    const checkInterval = setInterval(() => {
      const hasFormHandler = !!window.AnnouncementFormHandler;
      const hasDataManager = !!(
        window.SafeAdminDataManager || window.AdminDataManager
      );
      const hasForm = !!document.getElementById('announcementForm');

      if (hasFormHandler && hasDataManager && hasForm) {
        clearInterval(checkInterval);
        isInitialized = true;
        console.log(
          '[AnnouncementAdminInit] Todas las dependencias disponibles'
        );
        initFormHandler();
      }
    }, 100);

    // Timeout después de 10 segundos
    setTimeout(() => {
      if (!isInitialized) {
        clearInterval(checkInterval);
        console.warn('[AnnouncementAdminInit] Timeout esperando dependencias');
      }
    }, 10000);
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDependencies);
  } else {
    waitForDependencies();
  }

  console.log('[AnnouncementAdminInit] Script cargado');
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
