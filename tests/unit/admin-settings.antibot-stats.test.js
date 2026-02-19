import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('admin-settings anti-bot stats summary', () => {
  beforeEach(() => {
    vi.resetModules();
    window.AppState = {
      getState: vi.fn(key => (key === 'i18n.currentLanguage' ? 'es' : null)),
    };
    window.translate = vi.fn((key, _lang) => {
      if (key === 'admin_settings_antibot_stats_summary') {
        return 'Bloqueos 1h: {h1} | 24h: {h24}';
      }
      return key;
    });
  });

  it('formats anti-bot stats with counts and top reasons', async () => {
    await import('../../src/js/admin-settings.js');
    const controller = new window.SettingsController(null);

    const summary = controller.formatRegistrationStats({
      blockedLastHour: 12,
      blockedLastDay: 45,
      byReason: {
        rate_limit: 8,
        bot_user_agent: 3,
        honeypot_filled: 5,
      },
    });

    expect(summary).toContain('Bloqueos 1h: 12 | 24h: 45');
    expect(summary).toContain('rate_limit: 8');
    expect(summary).toContain('honeypot_filled: 5');
  });

  it('builds daily snapshot from getSecurityLogsDailyStats', async () => {
    await import('../../src/js/admin-settings.js');
    const controller = new window.SettingsController(null);

    vi.spyOn(controller, 'callFunctionWithFallback').mockResolvedValueOnce({
      daysReturned: 7,
      totals: {
        registrationBlocked: 22,
        adminActions: 9,
      },
      series: [
        { dateKey: '2026-02-18', registrationBlocked: 10, adminActions: 4 },
        { dateKey: '2026-02-19', registrationBlocked: 12, adminActions: 5 },
      ],
      byReason: {
        rate_limit: 14,
        bot_user_agent: 8,
      },
      byAdminAction: {
        settings_save: 5,
        revenue_reset: 2,
      },
      topAdminActions: [
        { key: 'settings_save', value: 5 },
        { key: 'revenue_reset', value: 2 },
      ],
    });

    const snapshot = await controller.getSecurityStatsSnapshot(7);

    expect(snapshot.mode).toBe('daily');
    expect(snapshot.source).toBe('getSecurityLogsDailyStats');
    expect(snapshot.daysReturned).toBe(7);
    expect(snapshot.totalBlocked).toBe(22);
    expect(snapshot.blockedLastDay).toBe(12);
    expect(snapshot.blockedLastHour).toBeNull();
    expect(snapshot.adminActions).toBe(9);
    expect(snapshot.byReason.rate_limit).toBe(14);
    expect(snapshot.topAdminActions[0]).toEqual({
      key: 'settings_save',
      value: 5,
    });
  });

  it('falls back to legacy getRegistrationBlockStats when daily callable fails', async () => {
    await import('../../src/js/admin-settings.js');
    const controller = new window.SettingsController(null);

    const spy = vi
      .spyOn(controller, 'callFunctionWithFallback')
      .mockRejectedValueOnce(new Error('daily unavailable'))
      .mockResolvedValueOnce({
        blockedLastHour: 6,
        blockedLastDay: 19,
        byReason: {
          honeypot_filled: 9,
          rate_limit: 7,
        },
        thresholdWarnHour: 12,
      });

    const snapshot = await controller.getSecurityStatsSnapshot(7);

    expect(spy).toHaveBeenNthCalledWith(
      1,
      'getSecurityLogsDailyStats',
      { days: 7 }
    );
    expect(spy).toHaveBeenNthCalledWith(2, 'getRegistrationBlockStats');
    expect(snapshot.mode).toBe('legacy');
    expect(snapshot.source).toBe('getRegistrationBlockStats');
    expect(snapshot.blockedLastHour).toBe(6);
    expect(snapshot.blockedLastDay).toBe(19);
    expect(snapshot.totalBlocked).toBe(19);
    expect(snapshot.thresholdWarnHour).toBe(12);
    expect(snapshot.adminActions).toBeNull();
  });
});
