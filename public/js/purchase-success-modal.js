/**
 * purchase-success-modal.js
 * Modal de confirmación de compra exitosa con scroll automático al producto
 * Versión: 2.11.0 - Sonido cross-browser + premium fireworks
 */

import {
  escapeAttr,
  escapeHtml,
  findByDataAttr,
  findAllByDataAttr,
} from './security/dom-safety.js';

'use strict';

function setupPurchaseSuccessModal() {
  const PURCHASE_SUCCESS_STYLE_ID = 'purchaseSuccessModalCriticalStyles';

  const ensurePurchaseSuccessModalStyles = () => {
    if (document.getElementById(PURCHASE_SUCCESS_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = PURCHASE_SUCCESS_STYLE_ID;
    style.textContent = `
      .purchase-success-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        border: none;
        margin: 0;
        background:
          radial-gradient(circle at 20% 10%, rgba(0, 255, 136, 0.08), transparent 35%),
          radial-gradient(circle at 80% 90%, rgba(0, 153, 255, 0.1), transparent 40%),
          rgba(0, 0, 0, 0.86);
        backdrop-filter: blur(10px);
        opacity: 0;
        animation: purchaseSuccessFadeIn 0.3s ease-out forwards;
      }
      dialog.purchase-success-overlay {
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
        padding: 24px;
      }
      dialog.purchase-success-overlay::backdrop {
        background: transparent;
      }
      .purchase-success-modal {
        position: relative;
        width: min(92vw, 600px);
        margin: auto;
        padding: 40px;
        border-radius: 16px;
        border: 1px solid rgba(0, 255, 136, 0.6);
        background: linear-gradient(135deg, #141b2d 0%, #101a33 100%);
        color: #fff;
        box-shadow:
          0 20px 60px rgba(0, 255, 136, 0.3),
          0 0 40px rgba(0, 255, 136, 0.12);
        transform: scale(0.8) translateY(50px);
        opacity: 0;
        animation: purchaseSuccessModalEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
        overflow: hidden;
      }
      .purchase-success-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #9ca3af;
        font-size: 28px;
        cursor: pointer;
      }
      .purchase-success-icon {
        width: 80px;
        height: 80px;
        margin: 0 auto 24px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        box-shadow: 0 0 26px rgba(0, 255, 136, 0.45);
      }
      .purchase-success-icon svg {
        width: 48px;
        height: 48px;
        color: #102118;
      }
      .purchase-success-title {
        margin: 0 0 16px;
        text-align: center;
        font-size: clamp(2rem, 4vw, 2.35rem);
        font-weight: 800;
        color: #00ff88;
      }
      .purchase-success-message {
        margin: 0 0 28px;
        text-align: center;
        color: #d1d5db;
        line-height: 1.65;
      }
      .purchase-success-sound-unlock {
        display: none;
      }
      .purchase-success-sound-unlock.show {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: -8px auto 20px;
      }
      .purchase-success-product {
        padding: 18px 20px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .purchase-success-product-name {
        text-align: center;
        font-size: 1.05rem;
        font-weight: 700;
        margin-bottom: 16px;
      }
      .purchase-success-info {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .purchase-success-info-item {
        padding: 14px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.22);
        text-align: center;
      }
      .purchase-success-info-label {
        font-size: 0.8rem;
        color: #9ca3af;
        margin-bottom: 6px;
      }
      .purchase-success-info-value {
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
      }
      .purchase-success-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin-top: 24px;
      }
      .purchase-success-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-width: 180px;
        padding: 14px 18px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        cursor: pointer;
        font-weight: 700;
      }
      .purchase-success-btn-primary {
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        color: #07150d;
      }
      .purchase-success-btn-secondary {
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
      }
      .purchase-success-overlay--force-visible {
        opacity: 1 !important;
      }
      .purchase-success-modal--force-visible {
        opacity: 1 !important;
        transform: scale(1) translateY(0) !important;
      }
      .purchase-success-overlay.closing {
        opacity: 0;
      }
      @keyframes purchaseSuccessFadeIn {
        to { opacity: 1; }
      }
      @keyframes purchaseSuccessModalEnter {
        to {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }
      @media (max-width: 640px) {
        .purchase-success-modal {
          padding: 28px 18px 22px;
        }
        .purchase-success-info {
          grid-template-columns: 1fr;
        }
        .purchase-success-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  };

  ensurePurchaseSuccessModalStyles();

  let confettiInitPromise = null;

  const ensureConfettiReady = () => {
    if (window.confetti && typeof window.confetti.launch === 'function') {
      return Promise.resolve(true);
    }
    if (confettiInitPromise) return confettiInitPromise;

    confettiInitPromise = import('./confetti-animation.js')
      .then(mod => {
        if (mod && typeof mod.initConfettiAnimation === 'function') {
          mod.initConfettiAnimation();
        }
        return window.confetti && typeof window.confetti.launch === 'function';
      })
      .catch(() => false)
      .finally(() => {
        confettiInitPromise = null;
      });

    return confettiInitPromise;
  };

  let sharedAudioContext = null;
  let pendingPlay = false;

  const getAudioContext = () => {
    if (!sharedAudioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      sharedAudioContext = new Ctx();
    }
    return sharedAudioContext;
  };

  const primeAudio = async () => {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return false;

    // Pequeño "ping" silencioso para desbloquear audio en móviles
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (_e) {}

    return true;
  };

  const bindAudioUnlock = () => {
    const handler = async () => {
      try {
        await primeAudio();
      } catch (_e) {}
    };
    document.addEventListener('pointerdown', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
  };
  bindAudioUnlock();

  const schedulePlayOnNextGesture = () => {
    if (pendingPlay) return;
    pendingPlay = true;
    const handler = async () => {
      pendingPlay = false;
      await primeAudio();
      await playSuccessSound();
    };
    document.addEventListener('pointerdown', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
  };

  const playSuccessSound = async () => {
    try {
      // Evitar warnings de autoplay si no hay activación del usuario.
      if (window.navigator?.userActivation && window.navigator.userActivation.isActive === false) {
        schedulePlayOnNextGesture();
        return false;
      }

      const audioContext = getAudioContext();
      if (!audioContext) return false;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      if (audioContext.state !== 'running') return false;

      const now = audioContext.currentTime;

      // Crear filtro lowpass para suavizar el sonido
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.Q.setValueAtTime(1, now);
      filter.connect(audioContext.destination);

      // Capa 1: Acorde mayor ascendente (melodía principal)
      const mainNotes = [
        { freq: 523.25, time: 0, duration: 0.2 }, // C5
        { freq: 659.25, time: 0.15, duration: 0.2 }, // E5
        { freq: 783.99, time: 0.3, duration: 0.25 }, // G5
        { freq: 1046.5, time: 0.5, duration: 0.4 }, // C6
      ];

      mainNotes.forEach(note => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(filter);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.freq, now + note.time);

        // Envelope ADSR
        gainNode.gain.setValueAtTime(0, now + note.time);
        gainNode.gain.linearRampToValueAtTime(0.25, now + note.time + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.2, now + note.time + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + note.time + note.duration);

        oscillator.start(now + note.time);
        oscillator.stop(now + note.time + note.duration);
      });

      // Capa 2: Armonía (notas graves para dar profundidad)
      const harmonyNotes = [
        { freq: 261.63, time: 0, duration: 0.4 }, // C4
        { freq: 329.63, time: 0.15, duration: 0.4 }, // E4
        { freq: 392.0, time: 0.3, duration: 0.6 }, // G4
      ];

      harmonyNotes.forEach(note => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(filter);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.freq, now + note.time);

        // Volumen más bajo para la armonía
        gainNode.gain.setValueAtTime(0, now + note.time);
        gainNode.gain.linearRampToValueAtTime(0.1, now + note.time + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + note.time + note.duration);

        oscillator.start(now + note.time);
        oscillator.stop(now + note.time + note.duration);
      });

      return true;
    } catch (_error) {
      return false;
    }
  };

  window.PurchaseSuccessAudio = {
    prime: primeAudio,
    play: playSuccessSound,
    schedulePlayOnNextGesture,
  };

  /**
   * Obtiene las traducciones del modal
   */
  function getTranslations() {
    const lang = window.i18n?.currentLanguage || 'es';

    const translations = {
      es: {
        title: '¡Compra Exitosa!',
        message: 'Gracias por tu compra. Tu descarga está lista y disponible por tiempo limitado.',
        timeLabel: 'Tiempo Disponible',
        downloadsLabel: 'Descargas',
        downloadBtn: 'Ir a Descargar',
        closeBtn: 'Cerrar',
        audioBtn: 'Activar audio',
        closeAriaLabel: 'Cerrar modal',
      },
      en: {
        title: 'Purchase Successful!',
        message:
          'Thank you for your purchase. Your download is ready and available for a limited time.',
        timeLabel: 'Available Time',
        downloadsLabel: 'Downloads',
        downloadBtn: 'Go to Download',
        closeBtn: 'Close',
        audioBtn: 'Enable audio',
        closeAriaLabel: 'Close modal',
      },
      pt: {
        title: 'Compra Bem-sucedida!',
        message:
          'Obrigado pela sua compra. Seu download está pronto e disponível por tempo limitado.',
        timeLabel: 'Tempo Disponível',
        downloadsLabel: 'Downloads',
        downloadBtn: 'Ir para Download',
        closeBtn: 'Fechar',
        audioBtn: 'Ativar audio',
        closeAriaLabel: 'Fechar modal',
      },
      fr: {
        title: 'Achat Réussi!',
        message:
          'Merci pour votre achat. Votre téléchargement est prêt et disponible pour une durée limitée.',
        timeLabel: 'Temps Disponible',
        downloadsLabel: 'Téléchargements',
        downloadBtn: 'Aller au Téléchargement',
        closeBtn: 'Fermer',
        audioBtn: 'Activer audio',
        closeAriaLabel: 'Fermer la fenêtre',
      },
    };

    return translations[lang] || translations.es;
  }

  /**
   * Muestra el modal de compra exitosa
   * @param {string} productId - ID del producto comprado
   * @param {string} productName - Nombre del producto
   */
  function showPurchaseSuccessModal(productId, productName) {
    ensurePurchaseSuccessModalStyles();

    // Evitar overlays duplicados de ejecuciones previas
    document.querySelectorAll('.purchase-success-overlay').forEach(node => {
      try {
        node.remove();
      } catch (_e) {}
    });

    const t = getTranslations();
    const safeProductId = String(productId ?? '');
    const safeProductIdAttr = escapeAttr(safeProductId);
    const safeProductName = escapeHtml(productName || '');
    // Crear overlay
    const overlay = document.createElement('dialog');
    overlay.className = 'purchase-success-overlay';
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'purchase-success-title');

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'purchase-success-modal';

    // HTML del modal (con traducciones)
    modal.innerHTML = `
      <button class="purchase-success-close" aria-label="${t.closeAriaLabel}">
        ×
      </button>

      <div class="purchase-success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <h2 id="purchase-success-title" class="purchase-success-title">
        ${t.title}
      </h2>

      <p class="purchase-success-message">
        ${t.message}
      </p>

      <button class="purchase-success-sound-unlock" type="button" aria-live="polite">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H3v6h3l5 4V5z"></path>
          <path d="M15.5 8.5a5 5 0 0 1 0 7"></path>
          <path d="M18.5 6a8.5 8.5 0 0 1 0 12"></path>
        </svg>
        <span>${(t && t.audioBtn) || 'Activar audio'}</span>
      </button>

      <div class="purchase-success-product">
        <div class="purchase-success-product-name">${safeProductName}</div>
        
        <div class="purchase-success-info">
          <div class="purchase-success-info-item">
            <div class="purchase-success-info-label">${t.timeLabel}</div>
            <div class="purchase-success-info-value">48h</div>
          </div>
          <div class="purchase-success-info-item">
            <div class="purchase-success-info-label">${t.downloadsLabel}</div>
            <div class="purchase-success-info-value">3</div>
          </div>
        </div>
      </div>

      <div class="purchase-success-actions">
        <button
          class="purchase-success-btn purchase-success-btn-primary"
          data-action="scroll-to-product"
          data-product-id="${safeProductIdAttr}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          ${t.downloadBtn}
        </button>
        <button class="purchase-success-btn purchase-success-btn-secondary" data-action="close-modal">
          ${t.closeBtn}
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    if (typeof overlay.showModal === 'function' && !overlay.open) {
      overlay.showModal();
    }
    document.body.classList.add('modal-open');
    if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
      window.DOMUtils.lockBodyScroll(true);
    } else {
      document.body.classList.add('overflow-hidden');
    }
    console.info('[PurchaseSuccessModal] opened', {
      productId,
      overlays: document.querySelectorAll('.purchase-success-overlay').length,
    });

    // Fallback defensivo: si algún CSS global pisa estilos, re-aplicar visibilidad.
    requestAnimationFrame(() => {
      try {
        const overlayStyle = getComputedStyle(overlay);
        const modalStyle = getComputedStyle(modal);
        if (
          overlayStyle.display === 'none' ||
          overlayStyle.visibility === 'hidden' ||
          Number(overlayStyle.opacity) === 0
        ) {
          overlay.classList.add('purchase-success-overlay--force-visible');
        }
        if (
          modalStyle.display === 'none' ||
          modalStyle.visibility === 'hidden' ||
          Number(modalStyle.opacity) === 0
        ) {
          modal.classList.add('purchase-success-modal--force-visible');
        }
      } catch (_e) {}
    });

    const isModalVisible = () => {
      if (!overlay.isConnected || !modal.isConnected) return false;
      try {
        const overlayStyle = getComputedStyle(overlay);
        const modalStyle = getComputedStyle(modal);
        const overlayRect = overlay.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();
        const hasOverlayBox = overlayRect.width >= 40 && overlayRect.height >= 40;
        const hasModalBox = modalRect.width >= 120 && modalRect.height >= 80;
        const isOnScreen =
          modalRect.bottom > 0 &&
          modalRect.right > 0 &&
          modalRect.left < window.innerWidth &&
          modalRect.top < window.innerHeight;
        return !(
          overlayStyle.display === 'none' ||
          overlayStyle.visibility === 'hidden' ||
          Number(overlayStyle.opacity) === 0 ||
          modalStyle.display === 'none' ||
          modalStyle.visibility === 'hidden' ||
          Number(modalStyle.opacity) === 0 ||
          !hasOverlayBox ||
          !hasModalBox ||
          !isOnScreen
        );
      } catch (_e) {
        return false;
      }
    };

    // 🎊 CONFETTI: garantizar disponibilidad aun en carga perezosa.
    ensureConfettiReady().then(ok => {
      if (!ok || !window.confetti || typeof window.confetti.launch !== 'function') {
        return;
      }
      if (typeof window.confetti.setHost === 'function') {
        window.confetti.setHost(overlay, {
          position: 'absolute',
          zIndex: '3',
        });
      }
      modal.classList.add('purchase-success-modal--confetti-hosted');
      const fireworkCastles = () => {
        if (!isModalVisible()) {
          return;
        }
        const w = window.innerWidth || 1200;
        const h = window.innerHeight || 800;
        const launchAt = (x, y, count) => {
          if (!isModalVisible()) return;
          window.confetti.launch(x, y, count, true);
        };

        // Torre izquierda / centro / derecha
        launchAt(w * 0.18, h * 0.76, 24);
        launchAt(w * 0.5, h * 0.72, 32);
        launchAt(w * 0.82, h * 0.76, 24);

        // Explosiones secundarias
        setTimeout(() => launchAt(w * 0.28, h * 0.72, 16), 120);
        setTimeout(() => launchAt(w * 0.72, h * 0.72, 16), 180);
        setTimeout(() => launchAt(w * 0.5, h * 0.64, 20), 240);

        // Lluvia suave al final para efecto premium
        setTimeout(() => {
          if (window.confetti && typeof window.confetti.rain === 'function') {
            window.confetti.rain(420, true);
          }
        }, 280);
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(fireworkCastles);
      });
    });

    // Reproducir sonido al abrir el modal (con fallback si el navegador bloquea autoplay)
    setTimeout(async () => {
      const ok = await playSuccessSound();
      if (!ok) {
        schedulePlayOnNextGesture();
        const unlockBtn = modal.querySelector('.purchase-success-sound-unlock');
        if (unlockBtn) {
          unlockBtn.classList.add('show');
          unlockBtn.addEventListener(
            'click',
            async () => {
              await primeAudio();
              const played = await playSuccessSound();
              if (played) {
                unlockBtn.classList.remove('show');
              }
            },
            { once: true }
          );
        }
      }
    }, 120);

    // Event listeners
    const closeBtn = modal.querySelector('.purchase-success-close');
    const scrollBtn = modal.querySelector('.purchase-success-btn-primary[data-product-id]');
    const closeModalBtn = modal.querySelector('[data-action="close-modal"]');

    // Cerrar modal
    const closeModal = (reason = 'manual') => {
      // Detener confetti si está activo
      if (window.confetti) {
        window.confetti.stop();
      }

      console.info('[PurchaseSuccessModal] closing', { reason, productId });
      overlay.classList.add('closing');
      setTimeout(() => {
        if (typeof overlay.close === 'function' && overlay.open) {
          overlay.close();
        }
        overlay.remove();
        document.body.classList.remove('modal-open');
        if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
          window.DOMUtils.lockBodyScroll(false);
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }, 300);
    };

    // Scroll al producto
    const scrollToProduct = (idOverride = null) => {
      const targetId = String(idOverride || productId || '');
      const productCardByAnnouncementId = findByDataAttr('data-announcement-id', targetId);
      const secureDownloadBtn =
        findAllByDataAttr(
          'data-product-id',
          targetId,
          '[data-action="secureDownload"][data-product-id]'
        )[0] || null;
      const productCard =
        productCardByAnnouncementId || secureDownloadBtn?.closest('.announcement-card') || null;
      if (productCard) {
        // Cerrar modal primero
        closeModal();

        // Esperar a que el modal se cierre y hacer scroll
        setTimeout(() => {
          productCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Efecto de highlight en la tarjeta
          productCard.classList.add('purchase-success-highlight-base');
          productCard.classList.add('purchase-success-highlight');

          setTimeout(() => {
            productCard.classList.remove('purchase-success-highlight');
            setTimeout(() => {
              productCard.classList.remove('purchase-success-highlight-base');
            }, 400);
          }, 2000);
        }, 350);
      } else {
        console.warn('[PurchaseSuccessModal] Tarjeta del producto no encontrada:', targetId);
        closeModal();
      }
    };

    // Eventos - Usar event listeners directos (no EventDelegation)
    // porque el modal se crea dinámicamente
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        if (e) e.stopPropagation();
        closeModal('close-button');
      });
    }
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', e => {
        if (e) e.stopPropagation();
        closeModal('secondary-button');
      });
    }
    if (scrollBtn) {
      scrollBtn.addEventListener('click', e => {
        if (e) e.preventDefault();
        if (e) e.stopPropagation();
        scrollToProduct();
      });
    }

    // Cerrar con ESC
    const handleEscape = e => {
      if (e.key === 'Escape') {
        closeModal('escape');
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Exponer globalmente
  window.showPurchaseSuccessModal = showPurchaseSuccessModal;
}

export function initPurchaseSuccessModal() {
  if (window.__PURCHASE_SUCCESS_MODAL_INITED__) {
    return;
  }

  window.__PURCHASE_SUCCESS_MODAL_INITED__ = true;
  setupPurchaseSuccessModal();
}

if (typeof window !== 'undefined' && !window.__PURCHASE_SUCCESS_MODAL_NO_AUTO__) {
  initPurchaseSuccessModal();
}
