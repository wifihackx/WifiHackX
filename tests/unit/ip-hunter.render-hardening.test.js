import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('ip-hunter hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(
      'ipHunterLogs',
      JSON.stringify([
        {
          ip: '<img src=x onerror=alert(1)>',
          location: 'Madrid<script>alert(1)</script>',
          provider: 'prov" onclick="alert(1)',
          region: '<svg onload=alert(1)>',
          timezone: 'UTC+1',
          ts: '2026-03-31T12:00:00.000Z',
        },
      ])
    );
    localStorage.setItem('ipHunterProvider', 'bad" ] option');
    document.body.innerHTML = `
      <div id="hunterMap"></div>
      <div id="mapScrim" class="is-hidden"></div>
      <div id="ipValue"></div>
      <div id="ispValue"></div>
      <div id="locValue"></div>
      <div id="regionValue"></div>
      <div id="tzValue"></div>
      <div id="statusValue"></div>
      <button id="scanBtn" type="button"></button>
      <button id="retryBtn" type="button"></button>
      <button id="protectBtn" type="button"></button>
      <select id="providerSelect">
        <option value="auto">Auto</option>
        <option value="ipapi">ipapi</option>
      </select>
      <div id="confidenceBadge"></div>
      <button id="downloadLogBtn" type="button"></button>
      <button id="downloadCsvBtn" type="button"></button>
      <button id="clearLogBtn" type="button"></button>
      <button id="toggleLogBtn" type="button"></button>
      <ul id="logList"></ul>
      <input id="logSearch" />
      <select id="logFilter"><option value="all">all</option></select>
      <span id="logCount"></span>
    `;
    window.fetch = vi.fn();
    window.L = undefined;
  });

  it('renders stored log entries as text and ignores malformed saved provider values', async () => {
    await loadModule('../../src/js/ip-hunter.js');

    const providerSelect = document.getElementById('providerSelect');
    providerSelect.dispatchEvent(new Event('change'));

    const firstLog = document.querySelector('.log-item');
    expect(firstLog?.querySelector('img')).toBeNull();
    expect(firstLog?.querySelector('script')).toBeNull();
    expect(firstLog?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(providerSelect.value).toBe('auto');
  });
});
