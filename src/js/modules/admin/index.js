// Admin module wrapper for legacy scripts.

import '../../../css/announcements-bundle.css';
import '../../../css/announcement-description.css';
import '../../../css/delete-announcement-modal.css';

import { initAdminLoader } from '../../admin-loader.js';
import { initDataAdmin } from '../data/index.js';

export function initAdmin() {
  initAdminLoader();
  initDataAdmin();
}
