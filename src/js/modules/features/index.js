// Misc feature module wrapper for legacy scripts.

import '../../../css/announcements-bundle.css';
import '../../../css/announcement-description.css';
import '../../../css/notification-system.css';
import '../../../css/cart-modal.css';
import '../../../css/ban-user-modal.css';

import { initNotificationSystem } from '../../notification-system.js';
import { initModuleInitializer } from '../../module-initializer.js';
import { initEventDelegationManager } from '../../event-delegation-manager.js';
import { initEventDelegationAdapter } from '../../event-delegation.js';
import { initBanSystem } from '../../ban-system.js';
import { initCommonHandlers } from '../../common-handlers.js?v=1.2';
import { initAppCheck } from '../../app-check-init.js?v=1.0';
import { initUtils } from '../../utils.js?v=1.0';
import { initI18n } from '../../i18n.js';
import { initCartManager } from '../../cart-manager.js?v=4.1.2';
import { initNavigationHelper } from '../../navigation-helper.js';
import { initCartActions } from '../../cart-actions.js';
import { initGeneratorsBundle } from '../../generators-bundle.js';
import { initViewInit } from '../../view-init.js';

let announcementBootstrapped = false;
const bootstrapAnnouncementSystem = () => {
  if (announcementBootstrapped) return;
  announcementBootstrapped = true;
  import('../../announcement-system.js?v=3.2.8')
    .then(mod => {
      if (mod && typeof mod.initAnnouncementSystem === 'function') {
        mod.initAnnouncementSystem();
      }
    })
    .catch(error => {
      console.error('[Features] Error cargando announcement-system:', error);
    });
};

function initAnnouncementSystemDeferred() {
  const trigger = () => {
    bootstrapAnnouncementSystem();
    window.removeEventListener('pointerdown', trigger, true);
    window.removeEventListener('keydown', trigger, true);
    window.removeEventListener('touchstart', trigger, true);
  };

  window.addEventListener('pointerdown', trigger, true);
  window.addEventListener('keydown', trigger, true);
  window.addEventListener('touchstart', trigger, true);

  const catalogSection = document.getElementById('catalogSection');
  if (catalogSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          bootstrapAnnouncementSystem();
        }
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(catalogSection);
  }

  // Fallback for passive sessions.
  setTimeout(bootstrapAnnouncementSystem, 30000);
}

let extendedFeaturesInitialized = false;
function initExtendedFeaturesDeferred() {
  if (extendedFeaturesInitialized) return;
  extendedFeaturesInitialized = true;

  Promise.all([
    import('../../sentry-init.js'),
    import('../../sw-register.js'),
    import('../../scrollbar-compensation.js'),
    import('../../announcement-form-handler.js'),
    import('../../security/SecureStorage.js'),
    import('../../ui/IconManager.js'),
    import('../../announcement-public-modal.js?v=2.6.1'),
    import('../../ultimate-download-manager.js?v=2.8'),
    import('../../announcement-admin-init.js?v=1.0'),
    import('../../revenue-reset.js'),
    import('../../footer-navigation.js'),
    import('../../admin-modals-component.js'),
    import('../../filter-buttons-generator.js'),
    import('../../language-options-generator.js'),
    import('../../lazy-loading.js'),
    import('../../system-integration.js'),
    import('../../admin-protection-system.js?v=1.1')
  ])
    .then(
      ([
        sentry,
        swRegister,
        scrollbarCompensation,
        announcementFormHandler,
        secureStorage,
        iconManager,
        announcementPublicModal,
        ultimateDownloadManager,
        announcementAdminInit,
        revenueReset,
        footerNavigation,
        adminModalsComponent,
        filterButtonsGenerator,
        languageOptionsGenerator,
        lazyLoading,
        systemIntegration,
        adminProtectionSystem
      ]) => {
        sentry.initSentry();
        swRegister.initServiceWorkerManager();
        scrollbarCompensation.initScrollbarCompensation();
        announcementFormHandler.initAnnouncementFormHandler();
        secureStorage.initSecureStorage();
        iconManager.initIconManager();
        announcementPublicModal.initAnnouncementPublicModal();
        ultimateDownloadManager.initUltimateDownloadManager();
        announcementAdminInit.initAnnouncementAdminInit();
        revenueReset.initRevenueResetManager();
        footerNavigation.initFooterNavigation();
        adminModalsComponent.initAdminModalsComponent();
        filterButtonsGenerator.initFilterButtonsGenerator();
        languageOptionsGenerator.initLanguageOptionsGenerator();
        lazyLoading.initLazyLoading();
        systemIntegration.initSystemIntegration();
        adminProtectionSystem.initAdminProtectionSystem();
      }
    )
    .catch(error => {
      console.error('[Features] Error cargando features extendidas:', error);
    });
}

export function initFeatures() {
  initModuleInitializer();
  initNotificationSystem();
  initEventDelegationManager();
  initEventDelegationAdapter();
  initCommonHandlers();
  initAppCheck();
  initNavigationHelper();
  initI18n();
  initUtils();
  initCartManager();
  initCartActions();
  initGeneratorsBundle();
  initViewInit();
  initAnnouncementSystemDeferred();
  initBanSystem();

  const triggerExtended = () => {
    initExtendedFeaturesDeferred();
    window.removeEventListener('pointerdown', triggerExtended, true);
    window.removeEventListener('keydown', triggerExtended, true);
    window.removeEventListener('touchstart', triggerExtended, true);
    window.removeEventListener('scroll', triggerExtended, true);
  };

  window.addEventListener('pointerdown', triggerExtended, true);
  window.addEventListener('keydown', triggerExtended, true);
  window.addEventListener('touchstart', triggerExtended, true);
  window.addEventListener('scroll', triggerExtended, true);
  setTimeout(triggerExtended, 30000);
}
