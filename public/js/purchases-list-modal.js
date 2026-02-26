/**
 * Purchases List Modal - Modal de Lista de Compras
 * Muestra historial completo de compras con detalles
 * @version 1.1.0 - Con modo test/live y eliminación
 */

'use strict';

const log = window.Logger || console;
const CAT = { ADMIN: 'ADMIN', UI: 'UI', ERR: 'ERR' };
const SUCCESSFUL_ORDER_STATUSES = new Set([
  'completed',
  'complete',
  'paid',
  'succeeded',
  'success',
  'approved',
  'captured',
  'authorized',
  'active',
]);

function isSuccessfulOrderStatus(status) {
  const normalized = String(status || 'completed')
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return SUCCESSFUL_ORDER_STATUSES.has(normalized);
}

function normalizePurchaseDate(row = {}) {
  const ts =
    row.createdAt ||
    row.timestamp ||
    row.purchasedAt ||
    row.created_at ||
    row.paidAt ||
    row.paymentDate ||
    row.completedAt ||
    row.updatedAt ||
    null;
  if (!ts) return new Date();
  if (typeof ts === 'number') return new Date(ts);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  const parsed = new Date(ts);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getPurchaseValue(purchase = {}) {
  const defaultCandidates = [
    { key: 'price', scale: 1 },
    { key: 'total', scale: 1 },
    { key: 'totalPrice', scale: 1 },
    { key: 'total_price', scale: 1 },
    { key: 'amount_total', scale: 0.01 },
    { key: 'amount_cents', scale: 0.01 },
    { key: 'total_cents', scale: 0.01 },
    { key: 'amount', scale: 1 },
  ];

  const hasStripeSignals =
    String(purchase.provider || purchase.source || purchase.paymentMethod || '')
      .toLowerCase()
      .includes('stripe') ||
    !!purchase.sessionId ||
    purchase.amount_total !== undefined ||
    purchase.amount_cents !== undefined ||
    purchase.total_cents !== undefined;

  const candidates = hasStripeSignals
    ? [
        { key: 'amount_total', scale: 0.01 },
        { key: 'amount_cents', scale: 0.01 },
        { key: 'total_cents', scale: 0.01 },
        ...defaultCandidates,
      ]
    : defaultCandidates;

  for (const candidate of candidates) {
    if (purchase[candidate.key] === undefined || purchase[candidate.key] === null) {
      continue;
    }
    let raw = purchase[candidate.key];
    const rawString = typeof raw === 'string' ? raw : '';
    if (typeof raw === 'string') {
      raw = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
    }
    let value = parseFloat(raw);
    if (!Number.isFinite(value)) value = 0;
    value *= candidate.scale;

    if (
      ['amount', 'price', 'total', 'totalPrice', 'total_price'].includes(candidate.key) &&
      Number.isInteger(value) &&
      value >= 1000 &&
      !rawString.includes('.') &&
      !rawString.includes(',') &&
      (purchase.currency || purchase.currency_code || hasStripeSignals)
    ) {
      value = value / 100;
    }
    return value;
  }

  return 0;
}

async function loadPurchasesFromCurrentUserArray(db) {
  const user = firebase?.auth?.()?.currentUser || null;
  const uid = String(user?.uid || '').trim();
  if (!uid) return [];

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return [];

  const userRow = userDoc.data() || {};
  const list = Array.isArray(userRow.purchases) ? userRow.purchases : [];
  const rows = [];
  for (let idx = 0; idx < list.length; idx += 1) {
    const pid = list[idx];
    const productId = String(pid || '').trim();
    if (!productId) continue;
    let info = { title: 'Producto', price: 0 };
    try {
      const annDoc = await db.collection('announcements').doc(productId).get();
      const ann = annDoc.exists ? annDoc.data() || {} : {};
      info = {
        title: String(ann.name || ann.title || 'Producto').trim() || 'Producto',
        price: Number(ann.price ?? ann.amount ?? 0) || 0,
      };
    } catch (_e) {}
    rows.push({
      id: `self_array_${uid}_${productId}_${idx}`,
      sourceType: 'users.purchases.self',
      userId: uid,
      userEmail: String(user?.email || userRow.email || '').trim(),
      productId,
      productTitle: info.title,
      price: info.price,
      amount: info.price,
      currency: 'EUR',
      status: 'completed',
      paymentMethod: 'unknown',
      source: 'users.purchases.self',
      createdAt: normalizePurchaseDate({
        purchasedAt: userRow.updatedAt || userRow.createdAt || null,
      }),
    });
  }
  return rows;
}

class PurchasesListModal {
  constructor() {
    this.modal = null;
    this.purchases = [];
    this.filteredPurchases = [];
    this.isOpen = false;
    this._keyListenerBound = false;
    this._handleKeydown = null;
  }

  /**
   * Inicializa el modal
   */
  init() {
    this.createModal();
    this.attachEventListeners();
    log.info('PurchasesListModal inicializado', CAT.ADMIN);
  }

  /**
   * Crea la estructura HTML del modal
   */
  createModal() {
    const modalHTML = `
        <dialog class="purchases-modal-overlay modal" id="purchasesModalOverlay" aria-hidden="true">
          <div class="purchases-modal">
            <!-- Header -->
            <div class="purchases-modal-header">
              <h2 class="purchases-modal-title">
                <i data-lucide="shopping-bag"></i>
                Historial de Compras
              </h2>
              <button class="purchases-modal-close" id="closePurchasesModal" aria-label="Cerrar modal">
                ×
              </button>
            </div>

            <!-- Toolbar -->
            <div class="purchases-modal-toolbar">
              <div class="purchases-search-box">
                <i data-lucide="search"></i>
                <input 
                  type="text" 
                  id="purchasesSearchInput" 
                  placeholder="Buscar por email, producto o ID..."
                  autocomplete="off"
                />
              </div>
              <button class="purchases-clean-invalid-btn" id="cleanInvalidPurchasesBtn" type="button">
                Limpiar inválidas
              </button>
              <div class="purchases-stats">
                <div class="purchases-stat">
                  <span class="purchases-stat-label">Total</span>
                  <span class="purchases-stat-value" id="totalPurchasesCount">0</span>
                </div>
                <div class="purchases-stat">
                  <span class="purchases-stat-label">Ingresos</span>
                  <span class="purchases-stat-value" id="totalRevenueAmount">€0</span>
                </div>
              </div>
            </div>

            <!-- Content -->
            <div class="purchases-modal-content" id="purchasesModalContent">
              <div class="purchases-loading">
                <div class="purchases-loading-spinner"></div>
                <p>Cargando compras...</p>
              </div>
            </div>
          </div>
        </dialog>
      `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('purchasesModalOverlay');

    // Inicializar iconos de Lucide
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  /**
   * Adjunta event listeners
   */
  attachEventListeners() {
    // Cerrar modal
    const closeBtn = document.getElementById('closePurchasesModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Cerrar al hacer clic fuera del modal
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Cerrar con ESC
    if (!this._keyListenerBound) {
      this._handleKeydown = e => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
      document.addEventListener('keydown', this._handleKeydown);
      this._keyListenerBound = true;
    }

    // Búsqueda
    const searchInput = document.getElementById('purchasesSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        this.filterPurchases(e.target.value);
      });
    }
    const cleanInvalidBtn = document.getElementById('cleanInvalidPurchasesBtn');
    if (cleanInvalidBtn) {
      cleanInvalidBtn.addEventListener('click', async () => {
        await this.cleanInvalidPurchases();
      });
    }

    // Delegación de eventos para botones de eliminar
    const content = document.getElementById('purchasesModalContent');
    if (content) {
      content.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.purchase-delete-btn');
        if (deleteBtn) {
          const purchaseId = deleteBtn.dataset.purchaseId;
          await this.deletePurchase(purchaseId);
        }
      });
    }
  }

  /**
   * Abre el modal y carga las compras
   */
  async open() {
    if (!this.modal || !this.modal.isConnected) {
      // El modal puede ser removido por limpiezas globales al salir de admin.
      // Rehidratarlo evita "Dialog element is not connected".
      this.createModal();
      this.attachEventListeners();
    }

    if (!this.modal) {
      log.error('Modal no inicializado', CAT.ERR);
      return;
    }

    this.modal.classList.add('active');
    if (window.ModalManager?.open) {
      window.ModalManager.open(this.modal);
    } else {
      if (typeof this.modal.showModal === 'function') {
        if (!this.modal.open) this.modal.showModal();
      } else {
        window.DOMUtils.setDisplay(this.modal, 'flex');
      }
      window.DOMUtils.lockBodyScroll(true);
    }
    this.modal.setAttribute('aria-hidden', 'false');
    this.isOpen = true;

    log.info('Abriendo modal de compras...', CAT.ADMIN);

    // Cargar compras
    await this.loadPurchases();
  }

  /**
   * Cierra el modal
   */
  close() {
    if (!this.modal) return;

    this.modal.classList.remove('active');
    if (window.ModalManager?.close) {
      window.ModalManager.close(this.modal);
    } else {
      if (typeof this.modal.close === 'function' && this.modal.open) {
        this.modal.close();
      } else {
        window.DOMUtils.setDisplay(this.modal, 'none');
      }
      window.DOMUtils.lockBodyScroll(false);
    }
    this.modal.setAttribute('aria-hidden', 'true');
    this.isOpen = false;

    // Limpiar búsqueda
    const searchInput = document.getElementById('purchasesSearchInput');
    if (searchInput) {
      searchInput.value = '';
    }

    log.info('Modal de compras cerrado', CAT.ADMIN);
  }

  /**
   * Carga las compras desde Firestore
   */
  async loadPurchases() {
    const content = document.getElementById('purchasesModalContent');
    if (!content) return;

    try {
      // Mostrar loading
      content.innerHTML = `
          <div class="purchases-loading">
            <div class="purchases-loading-spinner"></div>
            <p>Cargando compras...</p>
          </div>
        `;

      let loadedFromServer = false;
      if (window.firebase?.functions) {
        try {
          const callable = window.firebase.functions().httpsCallable('getAdminPurchasesList');
          const result = await callable({ limit: 2000 });
          if (result?.data?.success && Array.isArray(result.data.purchases)) {
            const serverRows = result.data.purchases
              .map(row => ({
                ...row,
                createdAt: row.createdAtMs
                  ? new Date(Number(row.createdAtMs))
                  : normalizePurchaseDate(row),
              }))
              .filter(row => isSuccessfulOrderStatus(row.status));
            this.purchases = serverRows;
            loadedFromServer = serverRows.length > 0;
          }
        } catch (serverError) {
          log.warn(
            'getAdminPurchasesList no disponible, usando fallback Firestore',
            CAT.ADMIN,
            serverError
          );
        }
      }

      if (!loadedFromServer) {
        // Fallback Firestore directo
        const db = firebase.firestore();
        const ordersSnapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();

        const orderRows = ordersSnapshot.docs
          .map(doc => ({
            id: doc.id,
            sourceType: 'orders',
            ...doc.data(),
            createdAt: normalizePurchaseDate(doc.data()),
          }))
          .filter(row => isSuccessfulOrderStatus(row.status));

        if (orderRows.length > 0) {
          this.purchases = orderRows;
        } else if (typeof db.collectionGroup === 'function') {
          const purchasesSnapshot = await db.collectionGroup('purchases').get();
          this.purchases = purchasesSnapshot.docs
            .map(doc => {
              const row = doc.data() || {};
              const pathParts = String(doc.ref.path || '').split('/');
              const uid = pathParts.length >= 4 ? pathParts[1] : String(row.userId || '');
              return {
                id: doc.id,
                sourceType: 'users.purchases',
                ...row,
                userId: String(row.userId || uid || '').trim(),
                sourcePath: String(doc.ref?.path || ''),
                createdAt: normalizePurchaseDate(row),
              };
            })
            .filter(row => isSuccessfulOrderStatus(row.status));
        } else {
          this.purchases = await loadPurchasesFromCurrentUserArray(db);
        }
      }

      this.filteredPurchases = [...this.purchases];

      log.info(`Compras cargadas: ${this.purchases.length}`, CAT.ADMIN);

      // Actualizar estadísticas
      this.updateStats();

      // Renderizar compras
      this.renderPurchases();
    } catch (error) {
      log.error('Error cargando compras', CAT.ERR, error);
      content.innerHTML = `
          <div class="purchases-empty">
            <i data-lucide="alert-circle"></i>
            <h3>Error al cargar compras</h3>
            <p>${error.message}</p>
          </div>
        `;

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }

  /**
   * Actualiza las estadísticas
   */
  updateStats() {
    const totalCount = document.getElementById('totalPurchasesCount');
    const totalRevenue = document.getElementById('totalRevenueAmount');

    if (totalCount) {
      totalCount.textContent = this.filteredPurchases.length;
    }

    if (totalRevenue) {
      const revenue = this.filteredPurchases.reduce((sum, purchase) => {
        return sum + getPurchaseValue(purchase);
      }, 0);
      totalRevenue.textContent = `€${revenue.toFixed(2)}`;
    }
  }

  /**
   * Renderiza las compras
   */
  renderPurchases() {
    const content = document.getElementById('purchasesModalContent');
    if (!content) return;

    if (this.filteredPurchases.length === 0) {
      content.innerHTML = `
          <div class="purchases-empty">
            <i data-lucide="shopping-bag"></i>
            <h3>No hay compras</h3>
            <p>No se encontraron compras en el sistema.</p>
          </div>
        `;

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
      return;
    }

    const purchasesHTML = this.filteredPurchases
      .map(purchase => this.createPurchaseCard(purchase))
      .join('');

    content.innerHTML = `
        <div class="purchases-grid">
          ${purchasesHTML}
        </div>
      `;

    // Inicializar iconos de Lucide
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  /**
   * Crea una tarjeta de compra
   */
  createPurchaseCard(purchase) {
    const date = purchase.createdAt;
    const dateStr = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const status = purchase.status || 'completed';
    const statusClass = status.toLowerCase();
    const statusText =
      {
        completed: 'Completada',
        pending: 'Pendiente',
        failed: 'Fallida',
      }[status] || status;

    const paymentMethod = purchase.paymentMethod || 'stripe';
    const paymentIcon =
      {
        stripe: 'credit-card',
        paypal: 'dollar-sign',
      }[paymentMethod] || 'credit-card';

    const paymentText =
      {
        stripe: 'Stripe',
        paypal: 'PayPal',
      }[paymentMethod] || paymentMethod;

    const price = getPurchaseValue(purchase);

    // ✅ Detectar modo (test/live)
    const mode = purchase.mode || 'unknown';
    const modeClass = mode === 'test' ? 'test' : mode === 'live' ? 'live' : 'unknown';
    const modeText = mode === 'test' ? 'PRUEBA' : mode === 'live' ? 'REAL' : 'DESCONOCIDO';

    const canDelete =
      String(purchase.sourceType || 'orders') === 'orders' ||
      (String(purchase.sourceType || '') === 'users.purchases' &&
        !!String(purchase.userId || '').trim());

    return `
        <div class="purchase-card" data-purchase-id="${purchase.id}">
          <!-- Header -->
          <div class="purchase-card-header">
            <div class="purchase-user-info">
              <h3 class="purchase-user-name">
                <i data-lucide="user"></i>
                ${this.escapeHtml(purchase.userEmail || 'Usuario desconocido')}
              </h3>
              <p class="purchase-user-email">
                ID: ${this.escapeHtml(purchase.userId || 'N/A')}
              </p>
            </div>
            <div class="purchase-badges">
              <span class="purchase-mode-badge ${modeClass}">
                ${modeText}
              </span>
              <span class="purchase-status-badge ${statusClass}">
                ${statusText}
              </span>
            </div>
          </div>

          <!-- Producto -->
          <div class="purchase-product">
            <h4 class="purchase-product-title">
              <i data-lucide="package"></i>
              ${this.escapeHtml(purchase.productTitle || 'Producto')}
            </h4>
            <p class="purchase-product-id">
              ${this.escapeHtml(purchase.productId || 'N/A')}
            </p>
          </div>

          <!-- Detalles -->
          <div class="purchase-details">
            <div class="purchase-detail">
              <span class="purchase-detail-label">Precio</span>
              <span class="purchase-detail-value price">€${price.toFixed(2)}</span>
            </div>
            <div class="purchase-detail">
              <span class="purchase-detail-label">Método de Pago</span>
              <span class="purchase-detail-value payment-method">
                <i data-lucide="${paymentIcon}"></i>
                ${paymentText}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="purchase-card-footer">
            <div class="purchase-timestamp">
              <span class="purchase-date">
                <i data-lucide="calendar"></i>
                ${dateStr}
              </span>
              <span class="purchase-time">
                ${timeStr}
              </span>
            </div>
            ${
              canDelete
                ? `
            <button 
              class="purchase-delete-btn" 
              data-purchase-id="${purchase.id}"
              title="Eliminar compra"
              aria-label="Eliminar compra"
            >
              <i data-lucide="trash-2"></i>
            </button>
            `
                : '<span class="purchase-source-note">Solo lectura</span>'
            }
          </div>
        </div>
      `;
  }

  isInvalidPurchase(purchase) {
    const price = getPurchaseValue(purchase);
    const suspiciousPrice =
      Math.abs(price - 999) < 0.0001 ||
      Number(purchase?.price) === 99900 ||
      Number(purchase?.amount) === 99900;
    return suspiciousPrice;
  }

  async deletePurchaseRecord(db, purchase) {
    const sourceType = String(purchase.sourceType || 'orders');
    if (sourceType === 'orders') {
      await db.collection('orders').doc(String(purchase.id)).delete();
      return;
    }
    if (sourceType === 'users.purchases') {
      let uid = String(purchase.userId || '').trim();
      if (!uid && purchase.sourcePath) {
        const parts = String(purchase.sourcePath).split('/');
        uid = parts.length >= 4 ? String(parts[1] || '').trim() : '';
      }
      if (!uid) {
        throw new Error('No se pudo determinar userId para eliminar compra');
      }
      await db
        .collection('users')
        .doc(uid)
        .collection('purchases')
        .doc(String(purchase.id))
        .delete();
      return;
    }
    throw new Error(`Origen no soportado para eliminación: ${sourceType}`);
  }

  async cleanInvalidPurchases() {
    const invalid = this.purchases.filter(p => this.isInvalidPurchase(p));
    if (invalid.length === 0) {
      if (window.NotificationSystem) {
        window.NotificationSystem.info('No se detectaron compras inválidas');
      }
      return;
    }

    const confirmFirst = confirm(
      `Se detectaron ${invalid.length} compras inválidas.\n\n` +
        `Se eliminarán únicamente registros con precio sospechoso (€999).\n\n` +
        `¿Deseas continuar?`
    );
    if (!confirmFirst) return;

    const confirmSecond = confirm(
      `CONFIRMACIÓN FINAL\n\n` +
        `Esta limpieza eliminará ${invalid.length} registros y no se puede deshacer.\n\n` +
        `Pulsa OK para ejecutar.`
    );
    if (!confirmSecond) return;

    try {
      const db = firebase.firestore();
      let deleted = 0;
      let failed = 0;
      for (const purchase of invalid) {
        try {
          await this.deletePurchaseRecord(db, purchase);
          deleted += 1;
        } catch (_e) {
          failed += 1;
        }
      }

      if (window.NotificationSystem) {
        if (failed > 0) {
          window.NotificationSystem.warn(
            `Limpieza parcial: ${deleted} eliminadas, ${failed} con error`
          );
        } else {
          window.NotificationSystem.success(`Limpieza completada: ${deleted} compras eliminadas`);
        }
      }

      await this.loadPurchases();
    } catch (error) {
      log.error('Error en limpieza de compras inválidas', CAT.ERR, error);
      if (window.NotificationSystem) {
        window.NotificationSystem.error(`Error en limpieza: ${error.message}`);
      }
    }
  }

  /**
   * Elimina una compra con confirmación doble
   */
  async deletePurchase(purchaseId) {
    if (!purchaseId) return;

    // Buscar la compra
    const purchase = this.purchases.find(p => p.id === purchaseId);
    if (!purchase) {
      log.error('Compra no encontrada', CAT.ERR);
      return;
    }

    // Primera confirmación
    const confirmFirst = confirm(
      `¿Estás seguro de que quieres eliminar esta compra?\n\n` +
        `Usuario: ${purchase.userEmail}\n` +
        `Producto: ${purchase.productTitle}\n` +
        `Precio: €${getPurchaseValue(purchase).toFixed(2)}\n\n` +
        `Esta acción NO se puede deshacer.`
    );

    if (!confirmFirst) return;

    // Segunda confirmación (seguridad extra)
    const confirmSecond = confirm(
      `⚠️ CONFIRMACIÓN FINAL ⚠️\n\n` +
        `Vas a eliminar permanentemente esta compra.\n` +
        `¿Estás COMPLETAMENTE seguro?\n\n` +
        `Escribe "ELIMINAR" en tu mente y haz clic en OK para continuar.`
    );

    if (!confirmSecond) return;

    try {
      log.info(`Eliminando compra: ${purchaseId}`, CAT.ADMIN);

      const db = firebase.firestore();
      await this.deletePurchaseRecord(db, purchase);

      log.info('Compra eliminada exitosamente', CAT.ADMIN);

      // Mostrar notificación de éxito
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Compra eliminada correctamente');
      }

      // Recargar compras
      await this.loadPurchases();
    } catch (error) {
      log.error('Error eliminando compra', CAT.ERR, error);

      // Mostrar notificación de error
      if (window.NotificationSystem) {
        window.NotificationSystem.error(`Error al eliminar: ${error.message}`);
      } else {
        alert(`Error al eliminar la compra: ${error.message}`);
      }
    }
  }

  /**
   * Filtra las compras por búsqueda
   */
  filterPurchases(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredPurchases = [...this.purchases];
    } else {
      this.filteredPurchases = this.purchases.filter(purchase => {
        const email = (purchase.userEmail || '').toLowerCase();
        const product = (purchase.productTitle || '').toLowerCase();
        const productId = (purchase.productId || '').toLowerCase();
        const userId = (purchase.userId || '').toLowerCase();
        const id = (purchase.id || '').toLowerCase();

        return (
          email.includes(term) ||
          product.includes(term) ||
          productId.includes(term) ||
          userId.includes(term) ||
          id.includes(term)
        );
      });
    }

    this.updateStats();
    this.renderPurchases();
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

function ensureInstance() {
  if (!window.PurchasesListModal) {
    window.PurchasesListModal = new PurchasesListModal();
  }
}

function init() {
  ensureInstance();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.PurchasesListModal.init();
    });
  } else {
    window.PurchasesListModal.init();
  }

  window.showPurchasesList = function () {
    window.PurchasesListModal.open();
  };

  log.info('PurchasesListModal cargado', CAT.ADMIN);
}

export function initPurchasesListModal() {
  if (window.__PURCHASES_LIST_MODAL_INITED__) {
    return;
  }

  window.__PURCHASES_LIST_MODAL_INITED__ = true;
  init();
}

if (typeof window !== 'undefined' && !window.__PURCHASES_LIST_MODAL_NO_AUTO__) {
  initPurchasesListModal();
}
