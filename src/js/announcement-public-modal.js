/**
 * Sistema de modal de detalles públicos para anuncios
 * Compatible con el nuevo sistema centralizado de carga
 * Fuente única: edita `src/js`; `public/js` se sincroniza con `npm run mirror:sync`.
 *
 * @version 1.0.0
 * @author WifiHackX Team
 */

'use strict';

import { sanitizeHttpUrl } from './security/dom-safety.js';

function setupAnnouncementPublicModal() {
  function ensureAnnouncementUtilsLoaded() {
    if (globalThis.AnnouncementUtils) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="announcement-utils.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load announcement-utils.js'))
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'js/announcement-utils.js?v=1.0';
      script.defer = true;
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load announcement-utils.js'));
      document.body.appendChild(script);
    });
  }

  if (window.announcementSystem && window.announcementSystem.openPublicDetailModal) {
    if (window.Logger) {
      window.Logger.warn(
        'Sistema ya inicializado, deteniendo ejecución duplicada',
        'ANNOUNCEMENTS'
      );
    }
    return;
  }

  /**
   * Clase para gestionar modales de detalles de anuncios públicos
   */
  class AnnouncementPublicModal {
    constructor() {
      this.META_TEXT = {
        preparing: 'Tiempo restante: preparando acceso...',
        downloadsUnknown: 'Descargas disponibles: —',
      };
      this.currentModal = null;
      this.currentAnnouncement = null;
      this.syncInterval = null;
      this.lastOwnedState = null;
    }

    escapeAttr(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    buildDomId(prefix, value) {
      const normalized = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      return `${prefix}${normalized || 'item'}`;
    }

    buildSecureDownloadMarkup(options) {
      if (
        window.announcementSystem &&
        typeof window.announcementSystem.buildSecureDownloadMarkup === 'function'
      ) {
        return window.announcementSystem.buildSecureDownloadMarkup(options);
      }
      if (
        window.AnnouncementUtils &&
        typeof window.AnnouncementUtils.buildSecureDownloadMarkup === 'function'
      ) {
        return window.AnnouncementUtils.buildSecureDownloadMarkup(options);
      }
      return '';
    }

    getAnnouncementProductKeys(annData) {
      if (
        window.announcementSystem &&
        typeof window.announcementSystem.getAnnouncementProductKeys === 'function'
      ) {
        return window.announcementSystem.getAnnouncementProductKeys(annData);
      }
      if (globalThis.AnnouncementUtils) {
        return globalThis.AnnouncementUtils.getProductKeys(annData);
      }
      if (!annData) return [];
      const keys = [];
      if (annData.id) keys.push(annData.id);
      if (annData.productId) keys.push(annData.productId);
      if (annData.stripeId) keys.push(annData.stripeId);
      if (annData.stripeProductId) keys.push(annData.stripeProductId);
      return keys.filter(Boolean);
    }

    resolveOwnedProductId(annData) {
      if (!window.announcementSystem || !window.announcementSystem.ownedProducts) {
        return null;
      }
      if (
        window.announcementSystem.isResetSuppressed &&
        annData &&
        annData.id &&
        window.announcementSystem.isResetSuppressed(`ann:${annData.id}`)
      ) {
        return null;
      }
      const keys = this.getAnnouncementProductKeys(annData);
      const normalize = value =>
        window.announcementSystem &&
        typeof window.announcementSystem.normalizeProductKey === 'function'
          ? window.announcementSystem.normalizeProductKey(value)
          : String(value || '').trim();
      return keys.find(
        key =>
          window.announcementSystem.ownedProducts.has(normalize(key)) &&
          (!window.announcementSystem.isResetSuppressed ||
            !window.announcementSystem.isResetSuppressed(normalize(key)))
      );
    }

    buildActionButtonsHtml(annData) {
      const primaryProductId = annData.id || annData.productId || '';
      const ownedProductId = this.resolveOwnedProductId(annData);
      const isOwned = Boolean(ownedProductId);
      const downloadProductId = ownedProductId || primaryProductId;
      const safeAnnouncementId = this.escapeAttr(annData.id);
      const buyButtonId = this.buildDomId('buyNowBtn-', annData.id);
      const cartButtonId = this.buildDomId('addToCartBtn-', annData.id);

      const metaText =
        window.announcementSystem &&
        typeof window.announcementSystem.getDownloadMetaTextForAnnouncement === 'function'
          ? window.announcementSystem.getDownloadMetaTextForAnnouncement(annData)
          : null;

      const isExpired = metaText ? metaText.expired : false;
      const downloadLabel = isExpired ? 'Adquirido' : 'DESCARGAR [SECURE]';
      const html = isOwned
        ? this.buildSecureDownloadMarkup({
            buttonClass: 'announcement-detail-btn announcement-btn btn-download-secure w-full',
            announcementId: annData.id,
            productId: downloadProductId,
            timerText: metaText ? metaText.timerText : this.META_TEXT.preparing,
            downloadsText: metaText ? metaText.downloadsText : this.META_TEXT.downloadsUnknown,
            label: downloadLabel,
            isExpired,
          })
        : `
          <button class="announcement-detail-btn announcement-btn announcement-btn-buy premium-btn-neon" id="${buyButtonId}" data-announcement-id="${safeAnnouncementId}">
            <div class="btn-glow-layer"></div>
            <i data-lucide="zap"></i> <span data-translate="buy_now">Comprar Ahora</span>
          </button>
          <button class="announcement-detail-btn announcement-btn announcement-btn-cart premium-btn-glass" id="${cartButtonId}" data-announcement-id="${safeAnnouncementId}">
            <i data-lucide="shopping-cart"></i> <span data-translate="add_to_cart">Añadir al Carrito</span>
          </button>
        `;

      return {
        html,
        isOwned,
      };
    }

    syncModalButtons() {
      if (!this.currentModal || !this.currentAnnouncement) return;
      const actions = this.currentModal.querySelector('.announcement-detail-actions');
      if (!actions) return;

      const { html, isOwned } = this.buildActionButtonsHtml(this.currentAnnouncement);

      if (this.lastOwnedState === isOwned) return;
      this.lastOwnedState = isOwned;
      actions.innerHTML = html;

      if (window.lucide) {
        window.lucide.createIcons();
      }

      this.bindActionButtons(isOwned, this.currentAnnouncement);
    }

    bindActionButtons(isOwned, annData) {
      if (!this.currentModal) return;
      if (isOwned) return;

      const buyBtn = document.getElementById(this.buildDomId('buyNowBtn-', annData.id));
      const cartBtn = document.getElementById(this.buildDomId('addToCartBtn-', annData.id));

      if (buyBtn) {
        buyBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          this.addToCartAndClose(annData, true);
        });
      }

      if (cartBtn) {
        cartBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          this.addToCartAndClose(annData, false);
        });
      }
    }

    addToCartAndClose(annData, openCart) {
      // PASO 1: Cerrar modal INMEDIATAMENTE
      const modalToClose = this.currentModal;
      if (modalToClose) {
        modalToClose.remove();
        document.body.classList.remove('overflow-hidden');
        this.currentModal = null;
      }

      // PASO 2: Añadir directamente al carrito usando CartManager
      const tryAdd = (attempt = 0) => {
        if (window.CartManager && typeof window.CartManager.addItem === 'function') {
          // Preparar datos del producto
          const productData = {
            id: annData.id,
            title: annData.title || annData.name || 'Producto',
            price: parseFloat(annData.price) || 0,
            imageUrl:
              annData.imageUrl ||
              (annData.mainImage && annData.mainImage.url) ||
              annData.image ||
              '/Tecnologia.webp',
            stripeId: annData.stripeId,
          };

          window.CartManager.addItem(productData);

          if (openCart) {
            // Abrir el carrito después de añadir
            setTimeout(() => {
              if (typeof window.showCart === 'function') {
                window.showCart();
              }
            }, 100);
          }
          return;
        }

        if (attempt < 5) {
          setTimeout(() => tryAdd(attempt + 1), 150);
          return;
        }

        if (window.Logger) {
          window.Logger.error('CartManager no disponible', 'ANNOUNCEMENTS');
        }
        if (window.NotificationSystem) {
          window.NotificationSystem.error('Error al añadir al carrito');
        }
      };

      setTimeout(() => tryAdd(0), 100);
    }

    bindShareButton() {
      if (!this.currentModal) return;
      const shareBtn = this.currentModal.querySelector(
        '.announcement-share-btn[data-action="share"]'
      );
      if (!shareBtn) return;

      shareBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();

        const shareHandler =
          (window.EventDelegationManager &&
            window.EventDelegationManager.handlers &&
            window.EventDelegationManager.handlers.get('share')) ||
          (window.EventDelegation &&
            window.EventDelegation.handlers &&
            window.EventDelegation.handlers.get('share'));

        if (typeof shareHandler === 'function') {
          shareHandler(shareBtn, e);
          return;
        }

        const title = String(shareBtn.dataset.shareTitle || document.title || '').trim();
        const text = String(shareBtn.dataset.shareText || '').trim();
        const url = sanitizeHttpUrl(shareBtn.dataset.shareUrl, window.location.href);

        try {
          if (navigator.share) {
            await navigator.share({
              title,
              text,
              url,
            });
            return;
          }

          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            if (
              window.NotificationSystem &&
              typeof window.NotificationSystem.success === 'function'
            ) {
              window.NotificationSystem.success('Enlace copiado');
            }
          }
        } catch (_err) {
          if (window.NotificationSystem && typeof window.NotificationSystem.error === 'function') {
            window.NotificationSystem.error('No se pudo compartir');
          }
        }
      });
    }

    forceSyncOwned(productId) {
      if (!this.currentModal || !this.currentAnnouncement) return;
      const normalize = value =>
        window.announcementSystem &&
        typeof window.announcementSystem.normalizeProductKey === 'function'
          ? window.announcementSystem.normalizeProductKey(value)
          : String(value || '').trim();
      const normalizedProductId = normalize(productId);
      const keys = this.getAnnouncementProductKeys(this.currentAnnouncement).map(normalize);
      if (!keys.includes(normalizedProductId)) return;
      this.lastOwnedState = null;
      this.syncModalButtons();
    }

    /**
     * Abre el modal de detalles de un anuncio
     * @param {Object} ann - Datos del anuncio
     */
    openPublicDetailModal(ann) {
      if (!globalThis.AnnouncementUtils) {
        ensureAnnouncementUtilsLoaded().catch(() => {});
      }

      const videoId =
        ann.youtubeUrl || ann.videoUrl
          ? this.extractYoutubeId(ann.youtubeUrl || ann.videoUrl)
          : null;
      const price = Number.parseFloat(ann.price || 0).toFixed(2);

      const safeUrl = url => {
        try {
          if (typeof url !== 'string') return '';
          const u = url.trim();
          if (!u) return '';
          if (/^javascript:/i.test(u)) return '';
          if (/^data:/i.test(u) && !/^data:image\/(png|jpe?g|gif|webp);/i.test(u)) return '';
          if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(u)) return u;
          return '';
        } catch (_e) {
          return '';
        }
      };

      let mediaHtml = '';
      if (videoId) {
        mediaHtml = `
          <div class="announcement-detail-video">
            <h4><div class="youtube-icon"></div> Video Tutorial</h4>
            <div class="announcement-detail-video-wrapper">
              <div class="announcement-detail-video-wrapper-inner">
                <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1"
                        class="announcement-detail-iframe"
                        allow="fullscreen"
                        allowfullscreen
                        referrerpolicy="no-referrer-when-downgrade">
                </iframe>
              </div>
            </div>
          </div>`;
      } else if (ann.videoUrl && ann.videoUrl.includes('.mp4')) {
        const safeVideoUrl = safeUrl(ann.videoUrl);
        mediaHtml = `
          <div class="announcement-detail-video">
            <h4>Video del Producto</h4>
            <div class="announcement-detail-video-wrapper">
              <video controls class="announcement-detail-video-tag"><source src="${safeVideoUrl}" type="video/mp4"></video>
            </div>
          </div>`;
      } else {
        const img =
          safeUrl(ann.imageUrl || (ann.mainImage && ann.mainImage.url) || '') || '/Tecnologia.webp';
        mediaHtml = `
          <div class="announcement-detail-image" loading="lazy" decoding="async">
            <div class="announcement-detail-image-wrapper">
              <img src="${img}" alt="${this.escapeAttr(ann.title || ann.name)}">
            </div>
          </div>`;
      }

      this.currentAnnouncement = ann;
      const { html: actionButtonsHtml, isOwned } = this.buildActionButtonsHtml(ann);
      const baseOrigin =
        (typeof window !== 'undefined' && window.location && window.location.origin) ||
        'https://wifihackx.com';
      const shareUrl = `${baseOrigin}/?utm_source=share&utm_medium=announcement&utm_campaign=modal#ann-${encodeURIComponent(String(ann.id || ''))}`;
      const safeShareUrl = this.escapeAttr(safeUrl(shareUrl));
      const safeTitle = this.escapeHtml(ann.title || ann.name);

      const modalHtml = `
        <dialog class="announcement-modal modal active" id="announcementDetailModal" aria-hidden="true">
          <div class="announcement-modal-content">
            <div class="announcement-modal-header">
              <h3>${safeTitle}</h3>
              <div class="announcement-modal-tools">
                <button class="announcement-share-btn share-icon-btn" data-action="share" data-share-title="${this.escapeAttr(ann.title || ann.name)}" data-share-text="Producto WifiHackX" data-share-url="${safeShareUrl}" aria-label="Compartir anuncio">
                  <i data-lucide="share-2"></i>
                </button>
                <button class="announcement-modal-close modal-close" id="closeDetailModal" title="Cerrar" data-action="closeModal">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
            <div class="announcement-modal-body">
              <div class="announcement-detail-container">
                <!-- 1. VIDEO / MEDIA (Top) -->
                ${mediaHtml}
                
                <div class="announcement-detail-info">
                   <!-- 2. PRICE -->
                   <div class="announcement-detail-price">€${price}</div>

                   <!-- 3. BUTTONS (Buy & Add) -->
                   <div class="announcement-detail-actions">
                     ${actionButtonsHtml}
                   </div>
                </div>

                <!-- 4. DESCRIPTION (Bottom) -->
                <div class="announcement-detail-description" data-no-translate>
                  <h4><i data-lucide="file-text"></i> Descripción</h4>
                  <div class="description-content" data-no-translate>
                    ${this.renderDescription(ann.description || ann.announcementDescription || '')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </dialog>
      `;

      // Cerrar modales existentes
      this.closeAllModals();

      // Insertar nuevo modal
      // renderDescription sanitiza la descripción; el resto del modal es controlado por código
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      // Guardar referencia y abrir con ModalManager
      this.currentModal = document.getElementById('announcementDetailModal');
      // Asegurar nonce en estilos inyectados para cumplir CSP
      if (this.currentModal) {
        const nonce = globalThis.SECURITY_NONCE || globalThis.NONCE || '';
        const styleTags = this.currentModal.querySelectorAll('style');
        styleTags.forEach(styleEl => {
          if (!styleEl.hasAttribute('nonce')) {
            styleEl.setAttribute('nonce', nonce);
          }
        });
      }
      if (window.ModalManager) {
        window.ModalManager.open(this.currentModal);
      } else if (this.currentModal) {
        if (typeof this.currentModal.showModal === 'function') {
          if (!this.currentModal.open) this.currentModal.showModal();
        } else {
          window.DOMUtils.setDisplay(this.currentModal, 'flex');
        }
        this.currentModal.setAttribute('aria-hidden', 'false');
        window.DOMUtils.lockBodyScroll(true);
      }
      this.initDescriptionIframes();

      // CRÍTICO: Limpiar cualquier atributo data-translate que pueda haber quedado en la descripción
      if (this.currentModal) {
        const descContent = this.currentModal.querySelector('.description-content');
        if (descContent) {
          // Buscar y remover todos los atributos data-translate dentro de la descripción
          const elementsWithTranslate = descContent.querySelectorAll('[data-translate]');
          if (elementsWithTranslate.length > 0) {
            if (window.Logger) {
              window.Logger.warn(
                `Encontrados ${elementsWithTranslate.length} elementos con data-translate en descripción, limpiando...`,
                'ANNOUNCEMENTS'
              );
            }
            elementsWithTranslate.forEach(el => {
              el.removeAttribute('data-translate');
            });
          }
        }
      }

      // Aplicar traducciones al modal recién creado (DESPUÉS de limpiar la descripción)
      if (window.applyTranslations && window.currentLanguage) {
        window.applyTranslations(window.currentLanguage);
      }

      // Inicializar iconos Lucide si está disponible
      if (window.lucide) {
        window.lucide.createIcons();
      }

      // Bind evento de cierre
      const closeBtn = document.getElementById('closeDetailModal');
      if (closeBtn) {
        closeBtn.onclick = e => {
          if (e) e.preventDefault();
          this.closeAllModals();
        };
      }

      // Cerrar al hacer clic fuera del modal (backdrop)
      if (this.currentModal) {
        this.currentModal.onclick = e => {
          if (e.target === this.currentModal) {
            this.closeAllModals();
          }
        };
      }

      if (this.currentModal) {
        this.lastOwnedState = isOwned;
        this.bindActionButtons(isOwned, ann);
        this.bindShareButton();

        if (this.syncInterval) {
          clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(() => {
          this.syncModalButtons();
        }, 800);
      }
    }

    /**
     * Renderiza la descripción del anuncio
     * @param {string} desc - Descripción del anuncio
     * @returns {string} HTML de la descripción
     */
    renderDescription(desc) {
      if (!desc) return 'Sin descripción';

      const normalizeDescription = input => {
        let value = String(input || '');
        let trimmed = value.trim();

        if (
          (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
          trimmed = trimmed.slice(1, -1);
          value = trimmed;
        }

        if (value.includes('\\n') || value.includes('\\"') || value.includes('\\t')) {
          value = value
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
        }

        const decodeHtmlEntities = text => {
          const decoder = document.createElement('textarea');
          decoder.innerHTML = text;
          return decoder.value;
        };

        // Soporta contenido doblemente escapado (&amp;lt;...&amp;gt;)
        if (value.includes('&lt;') || value.includes('&gt;') || value.includes('&amp;lt;')) {
          let iterations = 0;
          let previous = value;
          while (iterations < 4) {
            const decoded = decodeHtmlEntities(previous);
            if (decoded === previous) break;
            previous = decoded;
            iterations += 1;
          }
          value = previous;
        }

        return value;
      };

      const raw = normalizeDescription(desc);
      const isSafeUrl = value => {
        if (!value || typeof value !== 'string') return false;
        const url = value.trim();
        if (!url) return false;
        if (/^javascript:/i.test(url)) return false;
        if (/^data:/i.test(url)) return /^data:image\//i.test(url);
        if (/^blob:/i.test(url)) return true;
        return /^(\/|\.\/|\.\.\/)/.test(url);
      };

      const scopeCss = (cssText, scope) => {
        if (!cssText) return '';

        // Extraer @import respetando comillas/paréntesis para no romper URLs
        // como Google Fonts (wght@300;400;...).
        const extractImports = css => {
          const imports = [];
          let output = '';
          let i = 0;

          while (i < css.length) {
            const lower = css.slice(i).toLowerCase();
            if (lower.startsWith('@import')) {
              let j = i + 7;
              let quote = null;
              let parenDepth = 0;

              while (j < css.length) {
                const ch = css[j];
                const prev = css[j - 1];

                if (quote) {
                  if (ch === quote && prev !== '\\') {
                    quote = null;
                  }
                } else if (ch === '"' || ch === "'") {
                  quote = ch;
                } else if (ch === '(') {
                  parenDepth += 1;
                } else if (ch === ')' && parenDepth > 0) {
                  parenDepth -= 1;
                } else if (ch === ';' && parenDepth === 0) {
                  j += 1;
                  break;
                }
                j += 1;
              }

              const stmt = css.slice(i, j).trim();
              if (stmt) imports.push(stmt);
              i = j;
              continue;
            }

            output += css[i];
            i += 1;
          }

          return {
            imports,
            cssWithoutImports: output,
          };
        };

        const { imports: _imports, cssWithoutImports } = extractImports(cssText);
        let stripped = cssWithoutImports;
        // MAX SECURITY: bloquear @import externos en descripción
        const safeImports = [];

        // Helper para parsear bloques respetando anidamiento (@keyframes, @media)
        const processBlocks = css => {
          let result = '';
          let i = 0;
          while (i < css.length) {
            let openBrace = css.indexOf('{', i);
            if (openBrace === -1) break;

            // Selector es el texto antes de la llave
            let selector = css.substring(i, openBrace).trim();

            // Encontrar la llave de cierre correspondiente
            let depth = 1;
            let j = openBrace + 1;
            while (j < css.length && depth > 0) {
              if (css[j] === '{') depth++;
              else if (css[j] === '}') depth--;
              j++;
            }

            let body = css.substring(openBrace + 1, j - 1);

            if (selector) {
              if (selector.startsWith('@')) {
                // Reglas at-rules (@keyframes, @media, etc)
                if (selector.toLowerCase().startsWith('@keyframes')) {
                  // Las keyframes no se scopean con el prefijo, son globales por nombre
                  result += `${selector} {${body}}\n`;
                } else {
                  // Otras como @media pueden contener selectores que sí necesitan scoping
                  result += `${selector} {${processBlocks(body)}}\n`;
                }
              } else {
                // Selectores normales
                const scopedSelector = selector
                  .split(',')
                  .map(s => {
                    const sel = s.trim();
                    if (!sel) return '';
                    if (sel.startsWith(scope)) return sel;
                    if (sel === 'body' || sel === 'html' || sel === ':root') {
                      return scope;
                    }
                    if (sel === '*') {
                      return `${scope}, ${scope} *`;
                    }
                    return `${scope} ${sel}`;
                  })
                  .filter(Boolean)
                  .join(', ');
                result += `${scopedSelector} {${body}}\n`;
              }
            }

            i = j;
          }
          return result;
        };

        const importBlock = safeImports.length ? `${safeImports.join('\n')}\n` : '';
        const scoped = processBlocks(stripped);

        return scoped ? `${importBlock}${scoped}` : importBlock;
      };

      const extractFullHtml = html => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          if (!doc.body)
            return {
              html,
              styles: '',
            };

          const styleTags = Array.from(doc.querySelectorAll('style'));
          const styles = [...styleTags.map(s => s.textContent || '')].filter(Boolean).join('\n');
          const bodyHtml = doc.body.innerHTML;
          return {
            html: bodyHtml,
            styles,
          };
        } catch (e) {
          console.error('Error in extractFullHtml:', e);
          return {
            html,
            styles: '',
          };
        }
      };

      const { html: extractedHtml, styles } = extractFullHtml(raw);
      const scopedStyles = scopeCss(styles, '.description-content');

      const hardenDangerousMarkup = html => {
        if (!html || typeof html !== 'string') return '';
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          doc
            .querySelectorAll('script, object, embed, base, iframe')
            .forEach(node => node.remove());

          doc.querySelectorAll('*').forEach(node => {
            Array.from(node.attributes).forEach(attr => {
              const name = (attr.name || '').toLowerCase();
              const value = (attr.value || '').trim();
              if (name.startsWith('on')) {
                node.removeAttribute(attr.name);
                return;
              }
              if (
                (name === 'src' || name === 'href' || name === 'xlink:href') &&
                /^javascript:/i.test(value)
              ) {
                node.removeAttribute(attr.name);
                return;
              }
              if (
                (name === 'src' || name === 'href' || name === 'xlink:href') &&
                !isSafeUrl(value)
              ) {
                node.removeAttribute(attr.name);
                return;
              }
              if (name === 'style' && /expression\s*\(|javascript\s*:/i.test(value)) {
                node.removeAttribute(attr.name);
              }
            });

            if (node.tagName && node.tagName.toLowerCase() === 'a') {
              node.setAttribute('rel', 'noopener noreferrer nofollow');
            }
          });

          return doc.body ? doc.body.innerHTML : html;
        } catch (_error) {
          return html;
        }
      };

      // KEY FIX: Sanitize ONLY the HTML body (never pass CSS through DOMPurify,
      // which strips style tag content by design). Re-inject scoped CSS afterwards.
      let cleanedBodyHtml = extractedHtml;

      if (extractedHtml.includes('<') && extractedHtml.includes('>')) {
        if (globalThis.sanitizePremiumHTML) {
          cleanedBodyHtml = globalThis.sanitizePremiumHTML(
            extractedHtml,
            'announcement-detail-modal'
          );
        } else if (globalThis.DOMPurify && typeof globalThis.DOMPurify.sanitize === 'function') {
          cleanedBodyHtml = globalThis.DOMPurify.sanitize(extractedHtml, {
            ALLOWED_TAGS: [
              'b',
              'i',
              'em',
              'strong',
              'u',
              'p',
              'br',
              'ul',
              'ol',
              'li',
              'a',
              'span',
              'div',
              'img',
              'h1',
              'h2',
              'h3',
              'h4',
              'h5',
              'h6',
              'blockquote',
              'code',
              'pre',
              'hr',
              'table',
              'thead',
              'tbody',
              'tr',
              'th',
              'td',
              'video',
              'source',
              'svg',
              'path',
              'use',
              'header',
              'footer',
              'section',
              'article',
              'circle',
              'rect',
              'line',
              'polyline',
              'polygon',
              'ellipse',
              'g',
              'defs',
              'linearGradient',
              'radialGradient',
              'stop',
              'filter',
              'feGaussianBlur',
              'feOffset',
              'feMerge',
              'feMergeNode',
              'feColorMatrix',
              'mask',
              'clippath',
            ],
            ALLOWED_ATTR: [
              'href',
              'title',
              'target',
              'rel',
              'src',
              'alt',
              'class',
              'id',
              'style',
              'data-action',
              'data-id',
              'aria-label',
              'role',
              'width',
              'height',
              'loading',
              'referrerpolicy',
              'controls',
              'autoplay',
              'muted',
              'loop',
              'playsinline',
              'poster',
              'type',
              'data-text',
              'd',
              'viewBox',
              'fill',
              'stroke',
              'stroke-width',
              'r',
              'cx',
              'cy',
              'x',
              'y',
              'points',
              'gradientUnits',
              'gradientTransform',
              'x1',
              'y1',
              'x2',
              'y2',
              'offset',
              'stop-color',
              'stop-opacity',
              'opacity',
              'stdDeviation',
              'in',
              'result',
              'mode',
              'values',
              'mask',
              'clip-path',
              'fill-opacity',
              'stroke-opacity',
              'stroke-linecap',
              'stroke-linejoin',
              'stroke-dasharray',
              'stroke-dashoffset',
            ],
            ALLOW_DATA_ATTR: true,
          });
        } else if (globalThis.sanitizeHTML) {
          cleanedBodyHtml = globalThis.sanitizeHTML(extractedHtml, 'announcement-description');
        }
      }
      cleanedBodyHtml = hardenDangerousMarkup(cleanedBodyHtml);
      // Remover data-translate para evitar traducciones en la descripción
      cleanedBodyHtml = cleanedBodyHtml.replace(/\s+data-translate\s*=\s*"[^"]*"/gi, '');
      cleanedBodyHtml = cleanedBodyHtml.replace(/\s+data-translate\s*=\s*'[^']*'/gi, '');
      cleanedBodyHtml = cleanedBodyHtml.replace(/\s+data-translate\s*/gi, '');

      const detectHeroDescriptionLayout = html => {
        if (!html || typeof html !== 'string') return { html, heroLayout: false };
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const body = doc.body;
          if (!body) return { html, heroLayout: false };

          const directBlocks = Array.from(body.children).filter(
            node => !(node instanceof HTMLScriptElement) && !(node instanceof HTMLStyleElement)
          );
          if (directBlocks.length < 2 || directBlocks.length > 8) {
            return { html, heroLayout: false };
          }

          const first = directBlocks[0];
          const second = directBlocks[1];
          const firstTag = first?.tagName?.toLowerCase() || '';
          const secondTag = second?.tagName?.toLowerCase() || '';
          const firstText = (first?.textContent || '').replace(/\s+/g, ' ').trim();
          const secondText = (second?.textContent || '').replace(/\s+/g, ' ').trim();
          const badgeCandidate = directBlocks.find((node, index) => {
            if (index > 4) return false;
            const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
            return /(efectividad|effectiveness|eficacia|efficacité|efetividade)/i.test(text);
          });

          const looksLikeHeroTitle =
            ['h1', 'h2', 'h3'].includes(firstTag) &&
            firstText.length > 0 &&
            firstText.length <= 48 &&
            !/[.!?]/.test(firstText);
          const looksLikeHeroSubtitle =
            ['p', 'h2', 'h3', 'h4', 'div'].includes(secondTag) &&
            secondText.length > 0 &&
            secondText.length <= 140;

          if (!looksLikeHeroTitle || !looksLikeHeroSubtitle || !badgeCandidate) {
            return { html, heroLayout: false };
          }

          first.classList.add('wfx-desc-hero-title');
          second.classList.add('wfx-desc-hero-subtitle');
          badgeCandidate.classList.add('wfx-desc-hero-badge');

          return {
            html: body.innerHTML,
            heroLayout: true,
          };
        } catch (_error) {
          return { html, heroLayout: false };
        }
      };

      const { html: normalizedDescriptionHtml, heroLayout } =
        detectHeroDescriptionLayout(cleanedBodyHtml);
      cleanedBodyHtml = normalizedDescriptionHtml;

      const csp = [
        "default-src 'none'",
        'img-src data: blob:',
        'media-src data: blob:',
        "style-src 'unsafe-inline'",
        'font-src data:',
        "frame-src 'none'",
        "connect-src 'none'",
        "script-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
      ].join('; ');

      const sandboxBaseCss =
        `<style>
          html,body{margin:0;padding:0;background:transparent;overflow-x:hidden}
          *,*::before,*::after{box-sizing:border-box}
          body.description-content.description-content--hero-layout{
            text-align:center;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-title{
            width:100%;
            margin-left:auto;
            margin-right:auto;
            text-align:center;
            justify-content:center;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-subtitle{
            max-width:820px;
            margin-left:auto;
            margin-right:auto;
            text-align:center;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-badge{
            width:fit-content;
            max-width:min(100%, 820px);
            margin-left:auto;
            margin-right:auto;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-badge > *{
            margin-left:auto !important;
            margin-right:auto !important;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-center{
            text-align:center !important;
            margin-left:auto !important;
            margin-right:auto !important;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-width{
            width:100% !important;
          }
          body.description-content.description-content--hero-layout .wfx-desc-hero-display-block{
            display:block !important;
          }
        </style>`;
      const bodyClassNames = ['description-content'];
      if (heroLayout) bodyClassNames.push('description-content--hero-layout');
      const sandboxDocument = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}">${sandboxBaseCss}${scopedStyles ? `<style>${scopedStyles}</style>` : ''}</head><body class="${bodyClassNames.join(' ')}">${cleanedBodyHtml}</body></html>`;
      const escapeAttr = value =>
        String(value)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      return `<iframe class="announcement-description-iframe" sandbox referrerpolicy="no-referrer" loading="lazy" title="Descripción del anuncio" srcdoc="${escapeAttr(sandboxDocument)}"></iframe>`;
    }

    initDescriptionIframes() {
      if (!this.currentModal) return;
      const iframes = this.currentModal.querySelectorAll('.announcement-description-iframe');
      if (!iframes.length) return;

      const applyHeroLayoutFix = iframe => {
        try {
          const doc = iframe.contentDocument;
          const body = doc?.body;
          if (!body) return;

          const textOf = node => String(node?.textContent || '').replace(/\s+/g, ' ').trim();
          const allElements = Array.from(body.querySelectorAll('*'));
          const heading = allElements.find(node => {
            const tag = node.tagName?.toLowerCase();
            const text = textOf(node);
            return ['h1', 'h2', 'h3'].includes(tag) && text.length > 0 && text.length <= 48;
          });
          const badge = allElements.find(node => {
            const text = textOf(node);
            return /(efectividad|effectiveness|eficacia|efficacité|efetividade)/i.test(text);
          });

          if (!heading || !badge) return;

          const subtitle = allElements.find(node => {
            if (node === heading || node === badge) return false;
            const tag = node.tagName?.toLowerCase();
            const text = textOf(node);
            if (!['p', 'h2', 'h3', 'h4', 'div', 'span'].includes(tag)) return false;
            if (!text || text.length > 140) return false;
            const position =
              typeof node.compareDocumentPosition === 'function'
                ? heading.compareDocumentPosition(node)
                : 0;
            return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
          });

          const setCenter = node => {
            if (!node || !(node instanceof HTMLElement)) return;
            node.classList.add('wfx-desc-hero-center');
          };

          const centerWrapper = node => {
            if (!node || !(node instanceof HTMLElement)) return;
            let current = node;
            for (let i = 0; i < 3 && current && current !== body; i += 1) {
              if (!(current instanceof HTMLElement)) break;
              setCenter(current);
              if (i === 0) {
                current.classList.add('wfx-desc-hero-width');
              }
              current = current.parentElement;
            }
          };

          body.classList.add('description-content--hero-layout');

          setCenter(heading);
          heading.classList.add('wfx-desc-hero-display-block', 'wfx-desc-hero-width');
          centerWrapper(heading);

          if (subtitle) {
            setCenter(subtitle);
            centerWrapper(subtitle);
          }

          setCenter(badge);
          badge.classList.add('wfx-desc-hero-display-block');
          centerWrapper(badge);

          const badgeChildren = Array.from(badge.querySelectorAll('*'));
          badgeChildren.forEach(child => {
            if (!(child instanceof HTMLElement)) return;
            child.classList.add('wfx-desc-hero-center');
          });
        } catch (_error) {
          // No-op: el contenido del iframe puede variar y no debe romper el modal.
        }
      };

      const resizeIframe = iframe => {
        try {
          const doc = iframe.contentDocument;
          if (!doc || !doc.body) return;
          const bodyHeight = doc.body.scrollHeight || 0;
          const rootHeight = doc.documentElement ? doc.documentElement.scrollHeight : 0;
          const height = Math.max(bodyHeight, rootHeight, 240);
          iframe.setAttribute('height', String(height));
        } catch (_error) {
          // sandboxed access might fail in some browsers; keep CSS fallback
        }
      };

      iframes.forEach(iframe => {
        const contentWrapper = iframe.closest('.description-content');
        if (contentWrapper) {
          contentWrapper.classList.add('description-content--isolated');
        }
        const detailWrapper = iframe.closest('.announcement-detail-description');
        if (detailWrapper) {
          detailWrapper.classList.add('announcement-detail-description--isolated');
        }
        iframe.addEventListener('load', () => {
          applyHeroLayoutFix(iframe);
          resizeIframe(iframe);
          setTimeout(() => applyHeroLayoutFix(iframe), 60);
          setTimeout(() => resizeIframe(iframe), 150);
          setTimeout(() => applyHeroLayoutFix(iframe), 180);
          setTimeout(() => resizeIframe(iframe), 600);
        });
      });
    }

    /**
     * Extrae el ID de un video de YouTube
     * @param {string} url - URL del video
     * @returns {string|null} ID del video o null
     */
    extractYoutubeId(url) {
      if (!url) return null;
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([^&\s?]+)/
      );
      return match ? match[1] : null;
    }

    /**
     * Escapa HTML para prevenir XSS
     * @param {string} str - String a escapar
     * @returns {string} String escapado
     */
    escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Cierra todos los modales abiertos
     */
    closeAllModals() {
      // 1. Intentar cerrar vía ModalManager
      if (window.ModalManager && typeof window.ModalManager.closeAll === 'function') {
        window.ModalManager.closeAll();
      }

      // 2. Limpieza forzada de modales de anuncios (incluye remoción del DOM)
      const modals = document.querySelectorAll('.announcement-modal, .modal.active');
      modals.forEach(modal => {
        if (typeof modal.close === 'function' && modal.open) {
          modal.close();
        }
        modal.remove();
      });

      // 3. Restaurar scroll
      document.body.classList.remove('overflow-hidden');
      this.currentModal = null;
      this.currentAnnouncement = null;
      this.lastOwnedState = null;
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    }

    /**
     * Cierra el modal actual
     */
    closeModal() {
      this.closeAllModals();
    }
  }

  // Crear instancia global
  const modalSystem = new AnnouncementPublicModal();

  // Exponer en window para compatibilidad
  if (!window.announcementSystem) {
    window.announcementSystem = {};
  }

  window.announcementSystem.openPublicDetailModal = ann => modalSystem.openPublicDetailModal(ann);
  window.announcementSystem.closeAllModals = () => modalSystem.closeAllModals();
  window.announcementSystem.closeModal = () => modalSystem.closeModal();
  window.announcementSystem.syncPublicModalOwned = productId =>
    modalSystem.forceSyncOwned(productId);

  // También exponer directamente para facilidad de uso
  window.openPublicDetailModal = ann => modalSystem.openPublicDetailModal(ann);
}

export function initAnnouncementPublicModal() {
  if (window.__ANNOUNCEMENT_PUBLIC_MODAL_INITED__) {
    return;
  }

  window.__ANNOUNCEMENT_PUBLIC_MODAL_INITED__ = true;
  setupAnnouncementPublicModal();
}

if (typeof window !== 'undefined' && !window.__ANNOUNCEMENT_PUBLIC_MODAL_NO_AUTO__) {
  initAnnouncementPublicModal();
}
