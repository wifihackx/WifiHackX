// Data module wrapper for legacy scripts.

import { initRealTimeDataService } from '../../real-time-data-service.js';
import { initAnalyticsTracker } from '../../analytics-tracker.js';
import { initAnalyticsGa4 } from '../../analytics-ga4.js';
import { initEnhancedAnalytics } from '../../analytics-enhanced.js';
import { initRealUserMonitoring } from '../../real-user-monitoring.js';

export function initDataPublic() {
  initRealTimeDataService();
  initAnalyticsTracker();
  initAnalyticsGa4();
  initEnhancedAnalytics();
  initRealUserMonitoring();
}

export function initDataAdmin() {
  Promise.all([
    import('../../firestore-data-cleaner.js'),
    import('../../firebase-permissions-handler.js'),
    import('../../users-manager.js'),
    import('../../users-data.js'),
    import('../../users-actions.js'),
    import('../../users-renderer.js'),
    import('../../users-forms.js'),
    import('../../users-modals.js'),
    import('../../users-list-modal.js'),
    import('../../purchases-list-modal.js'),
    import('../../admin-settings.js'),
  ])
    .then(
      ([
        firestoreCleaner,
        firebasePermissions,
        usersManager,
        usersData,
        usersActions,
        usersRenderer,
        usersForms,
        usersModals,
        usersListModal,
        purchasesListModal,
        adminSettings,
      ]) => {
        firestoreCleaner.initFirestoreCleaner();
        firebasePermissions.initFirebasePermissionsHandler();
        usersData.initUsersData();
        usersActions.initUsersActions();
        usersRenderer.initUsersRenderer();
        usersForms.initUsersForms();
        usersModals.initUsersModalManager();
        usersListModal.initUsersListModal();
        purchasesListModal.initPurchasesListModal();
        usersManager.initUsersManager();
        adminSettings.initAdminSettings();
      }
    )
    .catch(error => {
      console.error('[DataModule] Error cargando módulos admin:', error);
    });
}
