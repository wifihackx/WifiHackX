/**
 * Admin support queue - review tickets submitted from FAQ support form.
 */

'use strict';

function setupAdminSupportRequests() {
  const STATUS_LABELS = {
    new: 'Nuevo',
    in_review: 'En revision',
    resolved: 'Resuelto',
    closed: 'Cerrado',
    spam: 'Spam',
  };

  const escapeHtml = value =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const escapeAttr = value => escapeHtml(value);

  const sanitizeEvidenceUrl = value => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    try {
      const url = new URL(normalized);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '';
      }
      return url.toString();
    } catch (_error) {
      return '';
    }
  };

  const manager = {
    isLoading: false,
    lastRequests: [],

    getGrid() {
      return document.getElementById('supportRequestsGrid');
    },

    getFilter() {
      return document.getElementById('supportStatusFilter');
    },

    getRefreshButton() {
      return document.getElementById('refreshSupportRequestsBtn');
    },

    getDb() {
      if (window.firebaseModular?.db && window.firebaseModular?.collection) {
        return { mode: 'modular', api: window.firebaseModular };
      }
      if (window.firebase?.firestore && typeof window.firebase.firestore === 'function') {
        return { mode: 'compat', api: window.firebase.firestore() };
      }
      return null;
    },

    async isAdminContext() {
      if (window.AppState?.state?.user?.isAdmin) {
        return true;
      }

      const currentUser =
        window.firebaseModular?.auth?.currentUser ||
        window.auth?.currentUser ||
        (window.firebase?.auth ? window.firebase.auth().currentUser : null);
      if (!currentUser) {
        return false;
      }

      try {
        if (window.AdminClaimsService?.isAdmin) {
          return await window.AdminClaimsService.isAdmin(currentUser);
        }
        const claims = window.getAdminClaims
          ? await window.getAdminClaims(currentUser, false)
          : (await currentUser.getIdTokenResult(false)).claims;
        return !!claims?.admin || claims?.role === 'admin' || claims?.role === 'super_admin';
      } catch (_error) {
        return false;
      }
    },

    async fetchRequests() {
      if (!(await this.isAdminContext())) {
        return [];
      }

      const adapter = this.getDb();
      if (!adapter) {
        throw new Error('Firestore admin no disponible');
      }

      if (adapter.mode === 'modular') {
        const mod = adapter.api;
        const queryRef = mod.query(
          mod.collection(mod.db, 'support_requests'),
          mod.orderBy('createdAt', 'desc'),
          mod.limit(50)
        );
        const snap = await mod.getDocs(queryRef);
        return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      }

      const snap = await adapter.api
        .collection('support_requests')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
    },

    async loadRequests() {
      const grid = this.getGrid();
      const refreshButton = this.getRefreshButton();
      if (!grid || this.isLoading) return;
      if (!(await this.isAdminContext())) {
        this.lastRequests = [];
        grid.innerHTML =
          '<div class="support-admin-empty">Acceso restringido a soporte.</div>';
        return;
      }

      this.isLoading = true;
      if (refreshButton) refreshButton.disabled = true;
      grid.innerHTML = '<div class="support-admin-empty">Cargando solicitudes de soporte...</div>';

      try {
        this.lastRequests = await this.fetchRequests();
        this.render();
      } catch (error) {
        grid.innerHTML =
          '<div class="support-admin-empty">No se pudieron cargar las solicitudes.</div>';
        if (window.NotificationSystem?.error && (await this.isAdminContext())) {
          window.NotificationSystem.error(error?.message || 'Error al cargar solicitudes');
        }
      } finally {
        this.isLoading = false;
        if (refreshButton) refreshButton.disabled = false;
      }
    },

    render() {
      const grid = this.getGrid();
      const filter = this.getFilter();
      if (!grid) return;

      const selectedStatus = filter?.value || 'all';
      const items =
        selectedStatus === 'all'
          ? this.lastRequests
          : this.lastRequests.filter(item => String(item.status || 'new') === selectedStatus);

      if (!items.length) {
        grid.innerHTML =
          '<div class="support-admin-empty">No hay solicitudes para el filtro seleccionado.</div>';
        return;
      }

      grid.innerHTML = items
        .map(item => {
          const createdAtMs = Number(item.createdAtMs || item.updatedAtMs || 0);
          const createdAt = createdAtMs
            ? new Date(createdAtMs).toLocaleString('es-ES')
            : 'Sin fecha';
          const status = String(item.status || 'new');
          const adminNotes = String(item.adminNotes || '');
          const screenshotUrl = sanitizeEvidenceUrl(item.screenshotUrl || item.evidenceUrl);
          const safeRequestId = escapeAttr(item.id);
          const safeScreenshotUrl = escapeAttr(screenshotUrl);

          return `
            <article class="support-admin-card" data-request-id="${safeRequestId}">
              <div class="support-admin-card-header">
                <div>
                  <h3>${escapeHtml(item.subject || 'Sin asunto')}</h3>
                  <p class="support-admin-meta">
                    <strong>${escapeHtml(item.name || 'Sin nombre')}</strong>
                    <span>${escapeHtml(item.email || 'Sin email')}</span>
                    <span>${escapeHtml(createdAt)}</span>
                  </p>
                </div>
                <span class="support-admin-badge support-admin-badge-${escapeHtml(status)}">${escapeHtml(
                  STATUS_LABELS[status] || status
                )}</span>
              </div>
              <div class="support-admin-details">
                <p><strong>Adaptador:</strong> ${escapeHtml(item.adapterModel || 'No indicado')}</p>
                <p><strong>Sistema:</strong> ${escapeHtml(item.operatingSystem || 'No indicado')}</p>
                <p><strong>Locale:</strong> ${escapeHtml(item.locale || 'es')}</p>
              </div>
              <div class="support-admin-message">${escapeHtml(item.message || '')}</div>
              ${
                screenshotUrl
                  ? `<p class="support-admin-evidence"><a href="${safeScreenshotUrl}" target="_blank" rel="noopener noreferrer">Abrir evidencia</a></p>`
                  : ''
              }
              <div class="support-admin-actions">
                <label>
                  Estado
                  <select class="support-admin-status-select">
                    ${Object.entries(STATUS_LABELS)
                      .map(
                        ([value, label]) =>
                          `<option value="${escapeHtml(value)}" ${
                            value === status ? 'selected' : ''
                          }>${escapeHtml(label)}</option>`
                      )
                      .join('')}
                  </select>
                </label>
                <label class="support-admin-notes">
                  Notas internas
                  <textarea class="support-admin-notes-input" rows="4">${escapeHtml(
                    adminNotes
                  )}</textarea>
                </label>
                <button class="admin-btn support-admin-save-btn" type="button">Guardar</button>
              </div>
            </article>
          `;
        })
        .join('');
    },

    async saveRequest(card) {
      const requestId = String(card?.dataset?.requestId || '').trim();
      const status = card?.querySelector('.support-admin-status-select')?.value || 'new';
      const adminNotes = card?.querySelector('.support-admin-notes-input')?.value || '';
      if (!requestId) return;

      const callableFactory = window.firebaseModular?.httpsCallable;
      if (typeof callableFactory !== 'function') {
        throw new Error('Callable admin no disponible');
      }

      const saveButton = card.querySelector('.support-admin-save-btn');
      if (saveButton) saveButton.disabled = true;

      try {
        const callable = callableFactory('updateSupportRequestStatus');
        await callable({ requestId, status, adminNotes });
        const target = this.lastRequests.find(item => item.id === requestId);
        if (target) {
          target.status = status;
          target.adminNotes = adminNotes;
          target.updatedAtMs = Date.now();
        }
        this.render();
        if (window.NotificationSystem?.success) {
          window.NotificationSystem.success(`Ticket ${requestId} actualizado`);
        }
      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    },

    bindEvents() {
      const filter = this.getFilter();
      const refreshButton = this.getRefreshButton();

      if (filter && !filter.dataset.boundSupportFilter) {
        filter.dataset.boundSupportFilter = '1';
        filter.addEventListener('change', () => this.render());
      }

      if (refreshButton && !refreshButton.dataset.boundSupportRefresh) {
        refreshButton.dataset.boundSupportRefresh = '1';
        refreshButton.addEventListener('click', () => this.loadRequests());
      }

      const grid = this.getGrid();
      if (grid && !grid.dataset.boundSupportGrid) {
        grid.dataset.boundSupportGrid = '1';
        grid.addEventListener('click', event => {
          const saveButton = event.target.closest('.support-admin-save-btn');
          if (!saveButton) return;
          const card = saveButton.closest('.support-admin-card');
          this.saveRequest(card).catch(error => {
            if (window.NotificationSystem?.error) {
              window.NotificationSystem.error(error?.message || 'No se pudo actualizar el ticket');
            }
          });
        });
      }
    },

    init() {
      this.bindEvents();
    },
  };

  manager.init();
  window.adminSupportRequestsManager = manager;
}

setupAdminSupportRequests();
