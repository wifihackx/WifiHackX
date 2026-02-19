// Admin module wrapper for legacy scripts.

import {
    initAdminLoader
} from '../../admin-loader.js';
import {
    initAdminUi
} from '../../admin.js';
import {
    initAdminModalsComponent
} from '../../admin-modals-component.js';
import {
    initAdminPanelInit
} from '../../admin-panel-init.js';
import {
    initAdminSectionInterceptor
} from '../../admin-section-interceptor.js';
import {
    initAdminNavigation
} from '../../admin-navigation-unified.js';
import {
    initDataAdmin
} from '../data/index.js';
import {
    initAnnouncementAdminInit
} from '../../announcement-admin-init.js?v=1.0';
import { initAdminActionAudit } from '../../admin-action-audit.js';

export function initAdmin() {
    initAdminActionAudit();
    initAdminLoader();
    initAdminUi();
    initAdminModalsComponent();
    initAdminPanelInit();
    initAdminNavigation();
    initAdminSectionInterceptor();
    initDataAdmin();
    initAnnouncementAdminInit();
}
