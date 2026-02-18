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
});

