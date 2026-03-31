/**
 * Admin Announcements Renderer
 * Sistema limpio para renderizar anuncios en el panel de administración
 * Basado en el sistema funcional de 1.html
 */

import { escapeAttr, findByDataAttr } from './security/dom-safety.js';

'use strict';

function setupAdminAnnouncementsRenderer() {
  const isLocalhostHost = () => {
    const host = String(
      window.__WFX_TEST_HOSTNAME__ || window.location?.hostname || ''
    ).toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  };

  /**
   * Clase para gestionar el renderizado de anuncios en el admin panel
   */
  class AdminAnnouncementsRenderer {
    constructor() {
      this.containerId = 'adminAnnouncementsGrid';
      this.container = null;
      this.announcements = [];
      this.isLoading = false;
      this.observer = null;
      this.pendingDeleteId = null;
      this.lastRenderSignature = '';
      this.handlersRegistered = false;
      this.containerClickBound = false;
      this.deleteModalOverlayHandler = null;
      this.deleteModalEscapeHandler = null;
    }

    /**
     * Limpiar recursos
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.container && this.containerClickHandler) {
        this.container.removeEventListener('click', this.containerClickHandler);
      }
      this.containerClickBound = false;
    }

    /**
     * Inicializar el renderer
     */
    async init() {
      // Esperar a que Firebase esté disponible
      await this.waitForFirebase();

      // Obtener referencia al contenedor
      this.container = document.getElementById(this.containerId);

      if (!this.container) {
        console.warn('[AdminAnnouncementsRenderer] Contenedor no encontrado:', this.containerId);
      }

      // Configurar observer para recarga automática cuando la sección se activa
      this.setupSectionObserver();

      this.ensureDelegationHandlersReady();
      this.setupContainerClickFallback();
    }

    registerDelegationHandlers() {
      if (!window.EventDelegation || this.handlersRegistered) return false;
      window.EventDelegation.registerHandler('adminDeleteAnnouncement', (target, _e) => {
        const id = target.dataset.id;
        this.deleteAnnouncement(id);
      });
      window.EventDelegation.registerHandler('adminEditAnnouncement', async (target, _e) => {
        const id = target.dataset.id;
        await this.editAnnouncement(id);
      });
      window.EventDelegation.registerHandler('adminViewAnnouncement', (target, _e) => {
        const id = target.dataset.id;
        this.viewAnnouncement(id);
      });
      window.EventDelegation.registerHandler('adminResetTimer', (target, _e) => {
        const id = target.dataset.id;
        this.resetProductTimer(id, target);
      });
      this.handlersRegistered = true;
      return true;
    }

    ensureDelegationHandlersReady(retries = 25) {
      if (this.registerDelegationHandlers()) return;
      if (retries <= 0) {
        console.warn(
          '[AdminAnnouncementsRenderer] EventDelegation no disponible, usando fallback local'
        );
        return;
      }
      setTimeout(() => this.ensureDelegationHandlersReady(retries - 1), 200);
    }

    setupContainerClickFallback() {
      if (!this.container) return;
      if (this.containerClickBound) return;

      this.containerClickHandler = e => {
        const target =
          e.target && typeof e.target.closest === 'function'
            ? e.target.closest('[data-action]')
            : null;
        if (!target || !this.container.contains(target)) return;

        const action = target.dataset.action;
        // Si ya existe handler centralizado, no duplicar ejecución.
        if (window.EventDelegation?.handlers?.has(action)) return;

        const id = target.dataset.id;
        switch (action) {
          case 'adminViewAnnouncement':
            e.preventDefault();
            this.viewAnnouncement(id);
            break;
          case 'adminEditAnnouncement':
            e.preventDefault();
            this.editAnnouncement(id);
            break;
          case 'adminDeleteAnnouncement':
            e.preventDefault();
            this.deleteAnnouncement(id);
            break;
          case 'adminResetTimer':
            e.preventDefault();
            this.resetProductTimer(id, target);
            break;
          default:
            break;
        }
      };

      this.container.addEventListener('click', this.containerClickHandler);
      this.containerClickBound = true;
    }

    /**
     * MutationObserver para detectar cuando la sección se activa
     */
    setupSectionObserver() {
      if (this.observer) this.observer.disconnect();

      const announcementsSection = document.getElementById('announcementsSection');
      if (!announcementsSection) {
        console.warn(
          '[AdminAnnouncementsRenderer] Sección no encontrada, reintentando observer...'
        );
        setTimeout(() => this.setupSectionObserver(), 500);
        return;
      }

      this.observer = new MutationObserver(mutations => {
        const adminView = document.getElementById('adminView');
        if (!adminView || !adminView.classList.contains('active')) return;

        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (
              mutation.target.id === 'announcementsSection' &&
              mutation.target.classList.contains('active')
            ) {
              this.renderAll();
            }
          }
        });
      });

      this.observer.observe(announcementsSection, {
        attributes: true,
        attributeFilter: ['class'],
      });

      // Carga inicial si ya está activo
      if (announcementsSection.classList.contains('active')) {
        this.renderAll();
      }
    }

    /**
     * Esperar a que Firebase esté disponible
     */
    async waitForFirebase() {
      return new Promise(resolve => {
        const checkFirebase = () => {
          if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            resolve();
          } else {
            setTimeout(checkFirebase, 100);
          }
        };
        checkFirebase();
      });
    }

    /**
     * Cargar y renderizar todos los anuncios
     */
    async renderAll() {
      // Asegurar que el contenedor existe (podría haber sido creado dinámicamente)
      if (!this.container) {
        this.container = document.getElementById(this.containerId);
      }
      if (this.container && !this.containerClickBound) {
        this.setupContainerClickFallback();
      }

      if (!this.container) {
        console.warn('[AdminAnnouncementsRenderer] Sin contenedor para renderizar');
        return;
      }

      if (this.isLoading) return;

      this.isLoading = true;
      try {
        if (this.isContainerEmpty()) {
          this.showLoading();
        }
        const db = firebase.firestore();
        let snapshot = null;

        try {
          snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        } catch (error) {
          console.warn(
            '[AdminAnnouncementsRenderer] orderBy(createdAt) failed, trying timestamp...',
            error
          );
          try {
            snapshot = await db.collection('announcements').orderBy('timestamp', 'desc').get();
          } catch (err2) {
            console.warn(
              '[AdminAnnouncementsRenderer] orderBy(timestamp) failed, loading without order...',
              err2
            );
            snapshot = await db.collection('announcements').get();
          }
        }

        const uniqueAnnouncements = [];
        const seenIds = new Set();

        snapshot.docs.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            uniqueAnnouncements.push({
              id: doc.id,
              ...doc.data(),
            });
          }
        });

        if (window.AdminCatalogSnapshotService?.schedule) {
          window.AdminCatalogSnapshotService.schedule({
            delayMs: 2500,
            silent: true,
          });
        }

        this.announcements = uniqueAnnouncements;

        if (this.announcements.length === 0) {
          this.showEmptyState();
        } else {
          const signature = this.getRenderSignature(this.announcements);
          if (signature !== this.lastRenderSignature) {
            this.lastRenderSignature = signature;
            this.renderCards();
          }
        }
      } catch (error) {
        console.error('[AdminAnnouncementsRenderer] Error:', error);
        this.showError(error.message);
      } finally {
        this.isLoading = false;
      }
    }

    /**
     * Mostrar spinner de carga
     */
    showLoading() {
      if (!this.container) return;
      XSSProtection.setInnerHTML(this.container, '<div class="loading-spinner"></div>');
    }

    isContainerEmpty() {
      if (!this.container) return true;
      const children = this.container.children;
      if (children.length === 0) return true;
      if (children.length === 1 && this.container.querySelector('.loading-spinner')) return true;
      if (children.length === 1 && this.container.querySelector('.admin-empty-state')) return true;
      return false;
    }

    /**
     * Mostrar estado vacío
     */
    showEmptyState() {
      if (!this.container) return;
      XSSProtection.setInnerHTML(
        this.container,
        `
                <div class="admin-empty-state">
                    <p>No hay anuncios creados.</p>
                </div>
            `
      );
    }

    /**
     * Mostrar error
     */
    showError(message) {
      if (!this.container) return;
      XSSProtection.setInnerHTML(
        this.container,
        `
                <div class="admin-error-state">
                    <p><strong>Error:</strong> ${XSSProtection.escape(message)}</p>
                </div>
            `
      );
    }

    /**
     * Renderizar tarjetas de anuncios
     */
    renderCards() {
      if (!this.container) return;
      XSSProtection.setInnerHTML(this.container, '');
      this.container.classList.add('admin-grid-view');

      const fragment = document.createDocumentFragment();
      this.announcements.forEach(ann => {
        fragment.appendChild(this.createCard(ann));
      });
      this.container.appendChild(fragment);
    }

    /**
     * Crear tarjeta de anuncio
     */
    createCard(ann) {
      const card = document.createElement('div');
      card.className = 'announcement-card';
      card.classList.add('relative');

      const title = XSSProtection.escape(ann.title || ann.name || 'Sin Título');
      const safeId = escapeAttr(ann.id);
      const price = Number.parseFloat(ann.price || 0).toFixed(2);
      const isActive = ann.active !== false;
      const fallbackImage = '/Tecnologia.webp';
      const img = XSSProtection.sanitizeURL(
        ann.imageUrl || (ann.mainImage && (ann.mainImage.url || ann.mainImage)) || fallbackImage
      );

      XSSProtection.setInnerHTML(
        card,
        `
                ${img ? `<div class="announcement-image"><img src="${img}" alt="${title}" loading="lazy"></div>` : ''}
                <div class="announcement-badges">
                    <span class="announcement-badge ${isActive ? 'announcement-badge--active' : 'announcement-badge--inactive'}">
                        ${isActive ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <div class="announcement-content">
                    <h4 class="announcement-title">${title}</h4>
                    <div class="announcement-price">€${price}</div>
                </div>
                <div class="announcement-actions">
                    <button class="admin-btn safe-action-btn" data-action="adminViewAnnouncement" data-id="${safeId}">Ver</button>
                    <button class="admin-btn safe-action-btn admin-btn--blue" data-action="adminEditAnnouncement" data-id="${safeId}">Editar</button>
                    <button class="admin-btn safe-action-btn admin-btn--amber" data-action="adminResetTimer" data-id="${safeId}" title="Reiniciar timer de descarga (48h)">🔄 Timer</button>
                    <button class="admin-btn safe-action-btn admin-btn--red" data-action="adminDeleteAnnouncement" data-id="${safeId}" data-params="${safeId}">Borrar</button>
                </div>
            `
      );
      const imgEl = card.querySelector('img');
      if (imgEl) {
        imgEl.addEventListener('error', () => {
          imgEl.src = fallbackImage;
        });
      }
      return card;
    }

    getRenderSignature(announcements) {
      return announcements
        .map(ann =>
          [
            ann.id,
            ann.updatedAt || ann.timestamp || ann.createdAt || '',
            ann.title || ann.name || '',
            ann.price || '',
            ann.imageUrl || (ann.mainImage && (ann.mainImage.url || ann.mainImage)) || '',
            ann.active !== false ? '1' : '0',
          ].join('|')
        )
        .join('||');
    }

    viewAnnouncement(id) {
      const ann = this.announcements.find(a => a.id === id);
      if (!ann) return;

      if (typeof window.openPublicDetailModal === 'function') {
        window.openPublicDetailModal(ann);
        return;
      }

      const system = window.announcementSystem;
      if (system && typeof system.ensurePublicModalLoaded === 'function') {
        system
          .ensurePublicModalLoaded()
          .then(() => {
            if (typeof window.openPublicDetailModal === 'function') {
              window.openPublicDetailModal(ann);
            }
          })
          .catch(err => {
            console.error('[AdminAnnouncementsRenderer] Failed to load public modal:', err);
          });
        return;
      }

      console.warn('[AdminAnnouncementsRenderer] Public detail modal not available');
    }

    async editAnnouncement(id) {
      if (!id) {
        return;
      }

      if (window.AdminLoader && typeof window.AdminLoader.ensureBundle === 'function') {
        try {
          await window.AdminLoader.ensureBundle('announcements', {
            skipAuthCheck: true,
          });
        } catch (_e) {}
      }

      if (!window.announcementFormHandler && window.AnnouncementFormHandler) {
        try {
          const DataManagerRef = window.SafeAdminDataManager || window.AdminDataManager;
          const dataManager =
            typeof DataManagerRef === 'function' ? new DataManagerRef() : DataManagerRef;
          const formHandler = new window.AnnouncementFormHandler(dataManager);
          if (formHandler.initialize('announcementForm')) {
            window.announcementFormHandler = formHandler;
          }
        } catch (_e) {}
      }
      if (window.announcementFormHandler) {
        const loaded = await window.announcementFormHandler.loadAnnouncement(id);
        if (!loaded) {
          return;
        }
        const form = document.getElementById('announcementForm');
        const announcementsSection = document.getElementById('announcementsSection');
        if (form) {
          form.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        } else if (announcementsSection) {
          announcementsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      } else if (window.NotificationSystem) {
        window.NotificationSystem.warning(
          'El formulario de anuncios aún no está listo. Inténtalo de nuevo en 1 segundo.'
        );
      }
    }

    deleteAnnouncement(id) {
      if (!id) {
        console.error('[AdminAnnouncementsRenderer] No se proporcionó ID para eliminar');
        return;
      }

      // Buscar si existe el modal premium
      const modalId = 'deleteAnnouncementModal';
      const modal = document.getElementById(modalId);

      if (modal) {
        this.pendingDeleteId = id;
        this.openDeleteModal(modal);
      } else {
        console.error('[AdminAnnouncementsRenderer] Modal no encontrado');
        // Fallback a confirmación simple
        if (confirm('¿Seguro que deseas eliminar este anuncio?')) {
          this.performDelete(id);
        }
      }
    }

    /**
     * Abrir y configurar el modal de eliminación
     */
    openDeleteModal(modal) {
      // Obtener elementos del modal
      const checkbox = modal.querySelector('#confirmDeleteCheckbox');
      const confirmBtn = modal.querySelector('#confirmDeleteAnnouncementBtn');
      const closeBtns = modal.querySelectorAll('[data-action="closeModal"]');

      // Resetear estado
      if (checkbox) {
        checkbox.checked = false;
      }

      if (confirmBtn) {
        confirmBtn.disabled = true;
      }

      // Configurar listener para el checkbox - Enfoque simplificado
      if (checkbox && confirmBtn) {
        // Reasignar handler para evitar duplicados sin recrear nodos.
        checkbox.onchange = e => {
          const isChecked = e.target.checked;
          // Re-obtener el botón cada vez para asegurar referencia correcta
          const btn = modal.querySelector('#confirmDeleteAnnouncementBtn');
          if (btn) {
            btn.disabled = !isChecked;
          }
        };
      }

      // Configurar listener para el botón de confirmar
      if (confirmBtn) {
        confirmBtn.onclick = async e => {
          e.preventDefault();
          e.stopPropagation();

          if (confirmBtn.disabled) {
            return;
          }

          if (this.pendingDeleteId) {
            await this.performDelete(this.pendingDeleteId);
            this.closeDeleteModal(modal);
          }
        };
      }

      // Configurar listeners para botones de cerrar
      closeBtns.forEach(btn => {
        btn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          this.closeDeleteModal(modal);
        };
      });

      // Listener para cerrar al hacer clic en el overlay (sin acumulación)
      if (this.deleteModalOverlayHandler) {
        modal.removeEventListener('click', this.deleteModalOverlayHandler);
      }
      this.deleteModalOverlayHandler = e => {
        if (e.target === modal) {
          this.closeDeleteModal(modal);
        }
      };
      modal.addEventListener('click', this.deleteModalOverlayHandler);

      // Listener para tecla ESC (sin acumulación)
      if (this.deleteModalEscapeHandler) {
        document.removeEventListener('keydown', this.deleteModalEscapeHandler);
      }
      this.deleteModalEscapeHandler = e => {
        if (e.key === 'Escape') {
          this.closeDeleteModal(modal);
        }
      };
      document.addEventListener('keydown', this.deleteModalEscapeHandler);

      // Mostrar modal
      modal.setAttribute('data-state', 'visible');
      modal.setAttribute('aria-hidden', 'false');
      if (typeof modal.showModal === 'function') {
        try {
          if (!modal.open) modal.showModal();
        } catch (_e) {
          window.DOMUtils.setDisplay(modal, 'flex');
        }
      }
      document.body.classList.add('overflow-hidden');
    }

    closeDeleteModal(modal) {
      // Ocultar modal usando data-state (el CSS maneja display)
      modal.setAttribute('data-state', 'hidden');
      modal.setAttribute('aria-hidden', 'true');
      if (typeof modal.close === 'function' && modal.open) {
        modal.close();
      }
      document.body.classList.remove('overflow-hidden');

      if (this.deleteModalOverlayHandler) {
        modal.removeEventListener('click', this.deleteModalOverlayHandler);
        this.deleteModalOverlayHandler = null;
      }
      if (this.deleteModalEscapeHandler) {
        document.removeEventListener('keydown', this.deleteModalEscapeHandler);
        this.deleteModalEscapeHandler = null;
      }

      // Limpiar estado
      this.pendingDeleteId = null;
    }

    async performDelete(id) {
      if (!id) return;
      try {
        if (window.AdminClaimsService?.requireAdminCurrentUser) {
          await window.AdminClaimsService.requireAdminCurrentUser();
        }
        if (!isLocalhostHost()) {
          throw new Error(
            'adminDeleteAnnouncement no disponible y el fallback directo está deshabilitado fuera de localhost.'
          );
        }
        await firebase.firestore().collection('announcements').doc(id).delete();
        if (window.AdminCatalogSnapshotService?.schedule) {
          window.AdminCatalogSnapshotService.schedule({
            delayMs: 1500,
            force: true,
            silent: true,
          });
        }
        if (window.NotificationSystem) {
          window.NotificationSystem.success('Anuncio eliminado correctamente');
        }
        this.renderAll();
      } catch (e) {
        console.error('Error eliminando anuncio:', e);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            e?.message || 'Error al eliminar el anuncio'
          );
        }
      }
    }

    /**
     * Reinicia el timer de descarga de un producto (solo para admins)
     */
    async resetProductTimer(id, targetBtn = null) {
      if (!id) {
        console.error('[AdminAnnouncementsRenderer] No se proporcionó ID para reiniciar timer');
        return;
      }

      const ensureDownloadManager = async () => {
        if (window.UltimateDownloadManager) return true;
        if (window.announcementSystem && window.announcementSystem.ensureDownloadManagerLoaded) {
          try {
            await window.announcementSystem.ensureDownloadManagerLoaded();
            return !!window.UltimateDownloadManager;
          } catch (_e) {
            return false;
          }
        }
        return false;
      };

      const ok = await ensureDownloadManager();
      if (!ok) {
        console.error('[AdminAnnouncementsRenderer] UltimateDownloadManager no disponible');
        if (window.NotificationSystem) {
          window.NotificationSystem.error('Sistema de descargas no disponible');
        }
        return;
      }

      const btn =
        targetBtn ||
        findByDataAttr('data-id', id, 'button[data-action="adminResetTimer"][data-id]');
      const originalLabel = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Reiniciando...';
      }

      // Confirmar acción
      if (window.safeConfirm) {
        window.safeConfirm(
          '¿Reiniciar timer de descarga?',
          'Esto eliminará el timer actual y permitirá nuevas compras. Esta acción es solo para pruebas.',
          async () => {
            await window.UltimateDownloadManager.resetProductTimer(id);
            if (btn) {
              btn.textContent = '✅ Reset aplicado';
              setTimeout(() => {
                btn.textContent = originalLabel || '🔄 Timer';
                btn.disabled = false;
              }, 1400);
            }
          }
        );
      } else {
        if (confirm('¿Estás seguro de que quieres reiniciar el timer de este producto?')) {
          await window.UltimateDownloadManager.resetProductTimer(id);
          if (btn) {
            btn.textContent = '✅ Reset aplicado';
            setTimeout(() => {
              btn.textContent = originalLabel || '🔄 Timer';
              btn.disabled = false;
            }, 1400);
          }
        }
        if (btn && btn.disabled) {
          btn.textContent = originalLabel || '🔄 Timer';
          btn.disabled = false;
        }
      }
    }

    async reload() {
      await this.renderAll();
    }
  }

  // Instancia global
  window.AdminAnnouncementsRenderer = AdminAnnouncementsRenderer;
  window.adminAnnouncementsRenderer = new AdminAnnouncementsRenderer();
  window.adminAnnouncementsRenderer.init();
}

export function initAdminAnnouncementsRenderer() {
  if (window.__ADMIN_ANNOUNCEMENTS_RENDERER_INITED__) {
    return;
  }

  window.__ADMIN_ANNOUNCEMENTS_RENDERER_INITED__ = true;
  setupAdminAnnouncementsRenderer();
}

if (typeof window !== 'undefined' && !window.__ADMIN_ANNOUNCEMENTS_RENDERER_NO_AUTO__) {
  initAdminAnnouncementsRenderer();
}
