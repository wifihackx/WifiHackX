import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('admin audit renderer hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ADMIN_AUDIT_RENDERER_INITED__ = false;
    window.__ADMIN_AUDIT_RENDERER_NO_AUTO__ = true;
    window.__WIFIHACKX_DEBUG__ = false;
    window.firebase = {
      auth: () => ({ currentUser: { uid: 'admin-1', email: 'admin@example.com' } }),
    };
    window.AppState = { state: { user: { isAdmin: true } } };
    window.MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    document.body.innerHTML = '<section id="dashboardSection"></section>';
  });

  it('escapes visible log fields and action attributes in audit rows', async () => {
    const mod = await loadModule('../../src/js/admin-audit-renderer.js');
    mod.initAdminAuditRenderer();

    const html = window.AdminAuditRenderer.createRowHTML({
      id: 'log" autofocus onclick="alert(1)',
      purchaseId: 'purchase" data-x="1',
      userId: 'user" onclick="alert(1)',
      productId: 'prod" autofocus',
      userEmail: '<img src=x onerror=alert(1)>',
      productName: '<svg onload=alert(1)>',
      ip: '<script>alert(1)</script>',
      geo: {
        location: '<b>Madrid</b>',
        isp: '<img src=x onerror=alert(1)>',
        flag: 'javascript:alert(1)',
      },
      timestamp: { seconds: 1711843200 },
      action: 'purchase',
      type: 'purchase',
      ipSource: 'purchase',
    });

    const tbody = document.createElement('tbody');
    tbody.innerHTML = html;

    const revokeBtn = tbody.querySelector('[data-action="adminRevokeAccess"]');
    const deleteBtn = tbody.querySelector('[data-action="adminDeleteLog"]');
    const detailsBtn = tbody.querySelector('[data-action="adminViewLogDetails"]');
    const userCell = tbody.querySelector('.audit-user');
    const productCell = tbody.querySelector('.audit-product');
    const ipCell = tbody.querySelector('.audit-ip');
    const locationImg = tbody.querySelector('.audit-location img');
    const locationCode = tbody.querySelector('.audit-flag-code');

    expect(tbody.querySelector('.audit-user img')).toBeNull();
    expect(tbody.querySelector('.audit-product svg')).toBeNull();
    expect(userCell?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(productCell?.textContent).toBe('<svg onload=alert(1)>');
    expect(ipCell?.textContent).toBe('<script>alert(1)</script>');
    expect(locationImg).toBeNull();
    expect(locationCode?.textContent).toBe('javascript:alert(1)');
    expect(revokeBtn?.dataset.id).toBe('purchase" data-x="1');
    expect(revokeBtn?.dataset.userid).toBe('user" onclick="alert(1)');
    expect(revokeBtn?.dataset.productid).toBe('prod" autofocus');
    expect(revokeBtn?.getAttribute('data-x')).toBeNull();
    expect(revokeBtn?.getAttribute('onclick')).toBeNull();
    expect(revokeBtn?.hasAttribute('autofocus')).toBe(false);
    expect(deleteBtn?.dataset.id).toBe('log" autofocus onclick="alert(1)');
    expect(detailsBtn?.dataset.id).toBe('log" autofocus onclick="alert(1)');
    expect(deleteBtn?.getAttribute('onclick')).toBeNull();
  });
});
