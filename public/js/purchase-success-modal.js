/**
 * purchase-success-modal.js
 * Modal de confirmación de compra exitosa con scroll automático al producto
 * Versión: 2.11.0 - Sonido cross-browser + premium fireworks
 */

'use strict';

function setupPurchaseSuccessModal() {

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
      const audioContext = getAudioContext();
      if (!audioContext) return false;

      // Evitar warnings de autoplay si no hay activación del usuario.
      if (
        window.navigator?.userActivation &&
        window.navigator.userActivation.isActive === false
      ) {
        schedulePlayOnNextGesture();
        return false;
      }

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
        gainNode.gain.linearRampToValueAtTime(
          0.25,
          now + note.time + 0.05
        );
        gainNode.gain.linearRampToValueAtTime(0.2, now + note.time + 0.1);
        gainNode.gain.linearRampToValueAtTime(
          0,
          now + note.time + note.duration
        );

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
        gainNode.gain.linearRampToValueAtTime(
          0,
          now + note.time + note.duration
        );

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
        message:
          'Gracias por tu compra. Tu descarga está lista y disponible por tiempo limitado.',
        timeLabel: 'Tiempo Disponible',
        downloadsLabel: 'Descargas',
        downloadBtn: 'Ir a Descargar',
        closeBtn: 'Cerrar',
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
    const t = getTranslations();
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'purchase-success-overlay';
    overlay.setAttribute('role', 'dialog');
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
        🔊 Activar sonido de celebración
      </button>

      <div class="purchase-success-product">
        <div class="purchase-success-product-name">${productName}</div>
        
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
        <button class="purchase-success-btn purchase-success-btn-primary" data-action="scroll-to-product" data-product-id="${productId}">
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

    // 🎊 CONFETTI: Fuegos tipo castillo al abrir el modal (compatibles con ConfettiAnimation)
    if (window.confetti && typeof window.confetti.launch === 'function') {
      const fireworkCastles = () => {
        const w = window.innerWidth || 1200;
        const h = window.innerHeight || 800;
        const launchAt = (x, y, count) => {
          window.confetti.launch(x, y, count);
        };

        // Torre izquierda / centro / derecha
        launchAt(w * 0.15, h * 0.72, 60);
        launchAt(w * 0.5, h * 0.68, 80);
        launchAt(w * 0.85, h * 0.72, 60);

        // Explosiones secundarias
        setTimeout(() => launchAt(w * 0.25, h * 0.7, 45), 220);
        setTimeout(() => launchAt(w * 0.75, h * 0.7, 45), 320);
        setTimeout(() => launchAt(w * 0.5, h * 0.6, 55), 420);
        setTimeout(() => launchAt(w * 0.38, h * 0.64, 38), 600);
        setTimeout(() => launchAt(w * 0.62, h * 0.64, 38), 700);

        // Lluvia suave al final para efecto premium
        setTimeout(() => {
          if (window.confetti && typeof window.confetti.rain === 'function') {
            window.confetti.rain(900);
          }
        }, 520);
      };

      setTimeout(fireworkCastles, 220);
    }

    // Reproducir sonido al abrir el modal (con fallback si el navegador bloquea autoplay)
    setTimeout(async () => {
      await primeAudio();
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
    const scrollBtn = modal.querySelector('[data-action="scroll-to-product"]');
    const closeModalBtn = modal.querySelector('[data-action="close-modal"]');

    // Cerrar modal
    const closeModal = () => {
      // Detener confetti si está activo
      if (window.confetti) {
        window.confetti.stop();
      }

      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
      }, 300);
    };

    // Scroll al producto
    const scrollToProduct = (idOverride = null) => {
      const targetId = idOverride || productId;
      const productCard = document.querySelector(
        `[data-announcement-id="${targetId}"]`
      );
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
        console.warn(
          '[PurchaseSuccessModal] Tarjeta del producto no encontrada:',
          targetId
        );
        closeModal();
      }
    };

    if (
      window.EventDelegationManager &&
      typeof window.EventDelegationManager.hasHandler === 'function' &&
      typeof window.EventDelegationManager.register === 'function'
    ) {
      if (!window.EventDelegationManager.hasHandler('scroll-to-product')) {
        window.EventDelegationManager.register('scroll-to-product', (element, event) => {
          if (event) {
            event.preventDefault();
            event.__scrollHandled = true;
            event.stopPropagation();
          }
          const targetId = element?.dataset?.productId || productId;
          scrollToProduct(targetId);
        });
      }
    }

    // Eventos - Usar event listeners directos (no EventDelegation)
    // porque el modal se crea dinámicamente
    closeBtn.addEventListener('click', () => closeModal());
    closeModalBtn.addEventListener('click', () => closeModal());
    scrollBtn.addEventListener('click', e => {
      if (e && e.__scrollHandled) return;
      scrollToProduct();
    });

    // Prevenir que los clics en los botones se propaguen al overlay
    closeBtn.addEventListener('click', e => e.stopPropagation());
    closeModalBtn.addEventListener('click', e => e.stopPropagation());
    scrollBtn.addEventListener('click', e => e.stopPropagation());

    // Cerrar con ESC
    const handleEscape = e => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Cerrar al hacer clic fuera del modal
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal();
      }
    });

  }

  // Exponer globalmente
  window.showPurchaseSuccessModal = showPurchaseSuccessModal;
}

function initPurchaseSuccessModal() {
  if (window.__PURCHASE_SUCCESS_MODAL_INITED__) {
    return;
  }

  window.__PURCHASE_SUCCESS_MODAL_INITED__ = true;
  setupPurchaseSuccessModal();
}

if (typeof window !== 'undefined' && !window.__PURCHASE_SUCCESS_MODAL_NO_AUTO__) {
  initPurchaseSuccessModal();
}

