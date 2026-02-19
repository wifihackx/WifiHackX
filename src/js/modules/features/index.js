// Misc feature module wrapper for legacy scripts.

import '../../core.js';
import '../../announcement-utils.js?v=1.0';
import {
    initNotificationSystem
} from '../../notification-system.js';
import {
    initModuleInitializer
} from '../../module-initializer.js';
import {
    initEventDelegationManager
} from '../../event-delegation-manager.js';
import {
    initEventDelegationAdapter
} from '../../event-delegation.js';
import {
    initBanSystem
} from '../../ban-system.js';
import {
    initCommonHandlers
} from '../../common-handlers.js?v=1.2';
import {
    initUtils
} from '../../utils.js?v=1.0';
import {
    initI18n
} from '../../i18n.js';
import {
    initCartManager
} from '../../cart-manager.js?v=4.1.2';
import {
    initNavigationHelper
} from '../../navigation-helper.js';
import {
    initCartActions
} from '../../cart-actions.js';
import {
    initSentry
} from '../../sentry-init.js';
import {
    initServiceWorkerManager
} from '../../sw-register.js';
import {
    initGeneratorsBundle
} from '../../generators-bundle.js';
import {
    initViewInit
} from '../../view-init.js';
import {
    initScrollbarCompensation
} from '../../scrollbar-compensation.js';
import {
    initAnnouncementFormHandler
} from '../../announcement-form-handler.js';
import {
    initSecureStorage
} from '../../security/SecureStorage.js';
import {
    initIconManager
} from '../../ui/IconManager.js';
import {
    initAnnouncementPublicModal
} from '../../announcement-public-modal.js?v=2.6.1';
import {
    initUltimateDownloadManager
} from '../../ultimate-download-manager.js?v=2.8';
import {
    initAnnouncementSystem
} from '../../announcement-system.js?v=3.2.8';

import {
    initRevenueResetManager
} from '../../revenue-reset.js';
import {
    initFooterNavigation
} from '../../footer-navigation.js';
import {
    initFilterButtonsGenerator
} from '../../filter-buttons-generator.js';
import {
    initLanguageOptionsGenerator
} from '../../language-options-generator.js';
import {
    initLazyLoading
} from '../../lazy-loading.js';
import {
    initSystemIntegration
} from '../../system-integration.js';
import {
    initAdminProtectionSystem
} from '../../admin-protection-system.js?v=1.1';

export function initFeatures() {
    initModuleInitializer();
    initNotificationSystem();
    initEventDelegationManager();
    initEventDelegationAdapter();
    initCommonHandlers();
    initNavigationHelper();
    initI18n();
    initUtils();
    initCartManager();
    initCartActions();
    initSentry();
    initServiceWorkerManager();
    initGeneratorsBundle();
    initViewInit();
    initSecureStorage();
    initIconManager();
    initAnnouncementPublicModal();
    initUltimateDownloadManager();
    initAnnouncementSystem();
    initBanSystem();
    initScrollbarCompensation();
    initAnnouncementFormHandler();

    initRevenueResetManager();
    initFilterButtonsGenerator();
    initLanguageOptionsGenerator();
    initLazyLoading();
    initFooterNavigation();
    initSystemIntegration();
    initAdminProtectionSystem();
}
