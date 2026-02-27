// Misc feature module wrapper for legacy scripts.

import '../../announcement-utils.js';
import {
    initModuleInitializer
} from '../../module-initializer.js';
import {
    initBanSystem
} from '../../ban-system.js';
import {
    initUtils
} from '../../utils.js';
import {
    initI18n
} from '../../i18n.js';
import {
    initCartManager
} from '../../cart-manager.js';
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
} from '../../announcement-public-modal.js';
import {
    initUltimateDownloadManager
} from '../../ultimate-download-manager.js';
import {
    initAnnouncementSystem
} from '../../announcement-system.js';

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
} from '../../admin-protection-system.js';

export function initFeatures() {
    initModuleInitializer();
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