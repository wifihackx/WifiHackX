import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('admin-dashboard-data regression', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = '<div id="dashboardStatsContainer"></div>';
    window.__ADMIN_DASHBOARD_DATA_INITED__ = false;
    window.__ADMIN_DASHBOARD_DATA_NO_AUTO__ = true;
    window.AdminDashboardContext = {
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trace: vi.fn(),
        startGroup: vi.fn(),
        endGroup: vi.fn(),
      },
      CAT: { ADMIN: 'ADMIN', FIREBASE: 'FIREBASE', INIT: 'INIT' },
      setState: vi.fn(),
      getState: vi.fn(() => ({
        users: 5,
        visits: 29,
        products: 1,
        orders: 2,
        revenue: 99.98,
        rawRevenue: 99.98,
        metricsSource: 'users.purchases',
      })),
    };
    window.DashboardStatsManager = function DashboardStatsManager() {};
  });

  it('loadStats does not retain stale orders/revenue when current sources resolve to zero', async () => {
    const mod = await loadModule('../../src/js/admin-dashboard-data.js');
    mod.initAdminDashboardData();

    const manager = new window.DashboardStatsManager();
    manager.waitForAuth = vi.fn().mockResolvedValue({ uid: 'admin-1' });
    manager.checkAdminStatus = vi.fn().mockResolvedValue(true);
    manager.getUsersCountFromFirestore = vi.fn().mockResolvedValue(5);
    manager.getVisitsCount = vi.fn().mockResolvedValue(29);
    manager.getProductsCount = vi.fn().mockResolvedValue(1);
    manager.getOrdersCount = vi.fn().mockResolvedValue(0);
    manager.getRevenue = vi.fn().mockResolvedValue(0);
    manager.getFallbackPurchasesMetrics = vi.fn().mockResolvedValue({
      count: 0,
      revenue: 0,
      source: 'none',
    });
    manager.getDashboardSnapshotFromServer = vi.fn().mockResolvedValue({});
    manager.getCurrentUserPurchasesArrayMetrics = vi.fn().mockResolvedValue({
      count: 0,
      revenue: 0,
      source: 'none',
    });
    manager.applyRevenueBaseline = vi.fn(value => Number(value || 0));
    manager.updateStatsUI = vi.fn();
    manager.showAuthError = vi.fn();
    manager.showPermissionError = vi.fn();
    manager.showError = vi.fn();

    await manager.loadStats();

    expect(window.AdminDashboardContext.setState).toHaveBeenCalledWith(
      'admin.stats',
      expect.objectContaining({
        users: 5,
        visits: 29,
        products: 1,
        orders: 0,
        revenue: 0,
        rawRevenue: 0,
        metricsSource: 'orders',
      })
    );
    expect(manager.updateStatsUI).toHaveBeenCalledWith(
      expect.objectContaining({
        orders: 0,
        revenue: 0,
        rawRevenue: 0,
        metricsSource: 'orders',
      })
    );
  });
});
