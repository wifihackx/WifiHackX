import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin-dashboard-data payments status', () => {
  beforeEach(() => {
    vi.resetModules();
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
      CAT: { ADMIN: 'ADMIN', INIT: 'INIT' },
      setState: vi.fn(),
      getState: vi.fn(),
    };
    window.DashboardStatsManager = function DashboardStatsManager() {};
    window.RuntimeConfigUtils = undefined;
    window.STRIPE_PUBLIC_KEY = '';
  });

  it('returns "Stripe no configurado" when no Stripe key is available', async () => {
    const mod = await import('../../src/js/admin-dashboard-data.js');
    mod.initAdminDashboardData();

    const manager = new window.DashboardStatsManager();
    expect(manager.getPaymentsStatus(null, null)).toBe('Stripe no configurado');
  });

  it('keeps webhook status flow when Stripe key is present', async () => {
    window.RuntimeConfigUtils = {
      isStripeConfigured: () => true,
      getPaymentsKeys: () => ({ stripePublicKey: 'pk_test_123' }),
    };

    const mod = await import('../../src/js/admin-dashboard-data.js');
    mod.initAdminDashboardData();

    const manager = new window.DashboardStatsManager();
    expect(manager.getPaymentsStatus(null, null)).toBe('Sin compras');
    expect(manager.getPaymentsStatus(Date.now() - 60_000, Date.now())).toBe(
      'Webhook OK'
    );
  });
});
