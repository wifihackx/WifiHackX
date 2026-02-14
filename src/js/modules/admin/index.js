// Admin module wrapper for legacy scripts.

import '../../../css/announcements-bundle.css';
import '../../../css/announcement-description.css';
import '../../../css/delete-announcement-modal.css';

import { initAdminLoader } from '../../admin-loader.js';
import { initAdminUi } from '../../admin.js';
import { initAdminModalsComponent } from '../../admin-modals-component.js';
import { initAdminPanelInit } from '../../admin-panel-init.js';
import { initAdminSectionInterceptor } from '../../admin-section-interceptor.js';
import { initAdminNavigation } from '../../admin-navigation-unified.js';
import { initDataAdmin } from '../data/index.js';

export function initAdmin() {
  initAdminLoader();
  initAdminUi();
  initAdminModalsComponent();
  initAdminPanelInit();
  initAdminNavigation();
  initAdminSectionInterceptor();
  initDataAdmin();
}
