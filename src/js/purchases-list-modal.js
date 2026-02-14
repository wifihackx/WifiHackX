/**
 * Purchases List Modal - Modal de Lista de Compras
 * Muestra historial completo de compras con detalles
 * @version 1.1.0 - Con modo test/live y eliminación
 */

'use strict';

  const log = window.Logger || console;
  const CAT = { ADMIN: 'ADMIN', UI: 'UI', ERR: 'ERR' };

  class PurchasesListModal {
    constructor() {
      this.modal = null;
      this.purchases = [];
      this.filteredPurchases = [];
      this.isOpen = false;
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
        <div class="purchases-modal-overlay hidden" id="purchasesModalOverlay" aria-hidden="true">
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
        </div>
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
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      // Búsqueda
      const searchInput = document.getElementById('purchasesSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', e => {
          this.filterPurchases(e.target.value);
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
      if (!this.modal) {
        log.error('Modal no inicializado', CAT.ERR);
        return;
      }

      this.modal.classList.add('active');
      window.DOMUtils.setDisplay(this.modal, 'flex');
      this.modal.setAttribute('aria-hidden', 'false');
      this.isOpen = true;
      window.DOMUtils.lockBodyScroll(true);

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
      window.DOMUtils.setDisplay(this.modal, 'none');
      this.modal.setAttribute('aria-hidden', 'true');
      this.isOpen = false;
      window.DOMUtils.lockBodyScroll(false);

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

        // Obtener compras desde Firestore
        const db = firebase.firestore();
        const ordersSnapshot = await db
          .collection('orders')
          .orderBy('createdAt', 'desc')
          .get();

        this.purchases = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convertir timestamp a Date si existe
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }));

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
          return sum + (parseFloat(purchase.price) || 0);
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

      const price = parseFloat(purchase.price) || 0;

      // ✅ Detectar modo (test/live)
      const mode = purchase.mode || 'unknown';
      const modeClass =
        mode === 'test' ? 'test' : mode === 'live' ? 'live' : 'unknown';
      const modeText =
        mode === 'test' ? 'PRUEBA' : mode === 'live' ? 'REAL' : 'DESCONOCIDO';

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
            <button 
              class="purchase-delete-btn" 
              data-purchase-id="${purchase.id}"
              title="Eliminar compra"
              aria-label="Eliminar compra"
            >
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
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
          `Precio: €${purchase.price}\n\n` +
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

        // Eliminar de Firestore
        const db = firebase.firestore();
        await db.collection('orders').doc(purchaseId).delete();

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
          window.NotificationSystem.error(
            `Error al eliminar: ${error.message}`
          );
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
