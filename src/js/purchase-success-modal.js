/**
 * purchase-success-modal.js
 * Modal de confirmación de compra exitosa con scroll automático al producto
 * Versión: 2.11.0 - Sonido cross-browser + premium fireworks
 */

'use strict';

function setupPurchaseSuccessModal() {
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
    // Evitar overlays duplicados de ejecuciones previas
    document.querySelectorAll('.purchase-success-overlay').forEach(node => {
      try {
        node.remove();
      } catch (_e) {}
    });

    const t = getTranslations();
    // Crear overlay
    const overlay = document.createElement('dialog');
    overlay.className = 'purchase-success-overlay';
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'purchase-success-title');

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'purchase-success-modal';

    // Defensa adicional: garantizar que quede por encima de otros overlays globales.
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background =
      'radial-gradient(circle at 20% 10%, rgba(0, 255, 136, 0.08), transparent 35%), radial-gradient(circle at 80% 90%, rgba(0, 153, 255, 0.1), transparent 40%), rgba(0, 0, 0, 0.86)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = '100100';
    modal.style.zIndex = '100101';
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.style.transform = 'none';
    // Estilos críticos inline para evitar "modal invisible" si CSS externo falla/pisa reglas.
    modal.style.background = 'linear-gradient(135deg, #141b2d 0%, #101a33 100%)';
    modal.style.color = '#ffffff';
    modal.style.maxWidth = '600px';
    modal.style.width = '90%';
    modal.style.padding = '32px';
    modal.style.borderRadius = '16px';
    modal.style.border = '1px solid rgba(0, 255, 136, 0.6)';
    modal.style.position = 'relative';

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
        <button class="purchase-success-btn purchase-success-btn-primary" data-product-id="${productId}">
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

    const titleEl = modal.querySelector('.purchase-success-title');
    const messageEl = modal.querySelector('.purchase-success-message');
    const iconWrapEl = modal.querySelector('.purchase-success-icon');
    const iconSvgEl = modal.querySelector('.purchase-success-icon svg');
    const productWrapEl = modal.querySelector('.purchase-success-product');
    const productNameEl = modal.querySelector('.purchase-success-product-name');
    const infoGridEl = modal.querySelector('.purchase-success-info');
    const actionsEl = modal.querySelector('.purchase-success-actions');
    const unlockSoundEl = modal.querySelector('.purchase-success-sound-unlock');
    const primaryBtnEl = modal.querySelector('.purchase-success-btn-primary');
    const secondaryBtnEl = modal.querySelector('.purchase-success-btn-secondary');
    const closeEl = modal.querySelector('.purchase-success-close');

    if (closeEl) {
      closeEl.style.position = 'absolute';
      closeEl.style.top = '14px';
      closeEl.style.right = '14px';
      closeEl.style.width = '36px';
      closeEl.style.height = '36px';
      closeEl.style.border = '0';
      closeEl.style.borderRadius = '8px';
      closeEl.style.background = 'transparent';
      closeEl.style.color = '#9ca3af';
      closeEl.style.fontSize = '24px';
      closeEl.style.cursor = 'pointer';
      closeEl.style.display = 'flex';
      closeEl.style.alignItems = 'center';
      closeEl.style.justifyContent = 'center';
    }
    if (iconWrapEl) {
      iconWrapEl.style.width = '80px';
      iconWrapEl.style.height = '80px';
      iconWrapEl.style.margin = '0 auto 22px';
      iconWrapEl.style.borderRadius = '999px';
      iconWrapEl.style.display = 'flex';
      iconWrapEl.style.alignItems = 'center';
      iconWrapEl.style.justifyContent = 'center';
      iconWrapEl.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)';
    }
    if (iconSvgEl) {
      iconSvgEl.style.width = '46px';
      iconSvgEl.style.height = '46px';
      iconSvgEl.style.display = 'block';
      iconSvgEl.style.color = '#0f172a';
    }
    if (titleEl) {
      titleEl.style.margin = '0 0 12px';
      titleEl.style.textAlign = 'center';
      titleEl.style.fontSize = '40px';
      titleEl.style.lineHeight = '1.15';
      titleEl.style.fontWeight = '800';
      titleEl.style.color = '#f9fafb';
    }
    if (messageEl) {
      messageEl.style.margin = '0 0 18px';
      messageEl.style.textAlign = 'center';
      messageEl.style.fontSize = '19px';
      messageEl.style.lineHeight = '1.5';
      messageEl.style.color = '#d1d5db';
    }
    if (productWrapEl) {
      productWrapEl.style.margin = '0 0 18px';
      productWrapEl.style.padding = '16px';
      productWrapEl.style.borderRadius = '12px';
      productWrapEl.style.border = '1px solid rgba(0, 255, 136, 0.25)';
      productWrapEl.style.background = 'rgba(0, 255, 136, 0.05)';
    }
    if (productNameEl) {
      productNameEl.style.margin = '0 0 12px';
      productNameEl.style.fontSize = '20px';
      productNameEl.style.fontWeight = '700';
      productNameEl.style.color = '#ffffff';
      productNameEl.style.textAlign = 'center';
    }
    if (infoGridEl) {
      infoGridEl.style.display = 'grid';
      infoGridEl.style.gridTemplateColumns = '1fr 1fr';
      infoGridEl.style.gap = '10px';
    }
    if (actionsEl) {
      actionsEl.style.display = 'flex';
      actionsEl.style.gap = '10px';
      actionsEl.style.flexWrap = 'wrap';
    }
    if (unlockSoundEl) {
      unlockSoundEl.style.display = 'none';
      unlockSoundEl.style.margin = '-2px auto 16px';
      unlockSoundEl.style.padding = '8px 14px';
      unlockSoundEl.style.borderRadius = '999px';
      unlockSoundEl.style.border = '1px solid rgba(0, 255, 136, 0.4)';
      unlockSoundEl.style.background = 'rgba(0, 255, 136, 0.08)';
      unlockSoundEl.style.color = '#b8ffd8';
      unlockSoundEl.style.cursor = 'pointer';
      unlockSoundEl.style.fontWeight = '600';
      unlockSoundEl.style.fontSize = '13px';
      unlockSoundEl.style.alignItems = 'center';
      unlockSoundEl.style.gap = '8px';
      unlockSoundEl.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.2)';
    }
    if (primaryBtnEl) {
      primaryBtnEl.style.flex = '1 1 260px';
      primaryBtnEl.style.minHeight = '46px';
      primaryBtnEl.style.border = '0';
      primaryBtnEl.style.borderRadius = '10px';
      primaryBtnEl.style.padding = '10px 14px';
      primaryBtnEl.style.cursor = 'pointer';
      primaryBtnEl.style.fontWeight = '700';
      primaryBtnEl.style.display = 'inline-flex';
      primaryBtnEl.style.alignItems = 'center';
      primaryBtnEl.style.justifyContent = 'center';
      primaryBtnEl.style.gap = '8px';
      primaryBtnEl.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)';
      primaryBtnEl.style.color = '#0f172a';
    }
    if (secondaryBtnEl) {
      secondaryBtnEl.style.flex = '1 1 150px';
      secondaryBtnEl.style.minHeight = '46px';
      secondaryBtnEl.style.border = '1px solid rgba(255,255,255,0.2)';
      secondaryBtnEl.style.borderRadius = '10px';
      secondaryBtnEl.style.padding = '10px 14px';
      secondaryBtnEl.style.cursor = 'pointer';
      secondaryBtnEl.style.fontWeight = '600';
      secondaryBtnEl.style.background = 'rgba(255,255,255,0.04)';
      secondaryBtnEl.style.color = '#f3f4f6';
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    if (typeof overlay.showModal === 'function' && !overlay.open) {
      overlay.showModal();
    }
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    document.body.classList.add('modal-open');
    if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
      window.DOMUtils.lockBodyScroll(true);
    } else {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
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
          overlay.style.display = 'flex';
          overlay.style.visibility = 'visible';
          overlay.style.opacity = '1';
        }
        if (
          modalStyle.display === 'none' ||
          modalStyle.visibility === 'hidden' ||
          Number(modalStyle.opacity) === 0
        ) {
          modal.style.display = 'block';
          modal.style.visibility = 'visible';
          modal.style.opacity = '1';
          modal.style.transform = 'none';
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
            window.confetti.rain(900, true);
          }
        }, 520);
      };

      setTimeout(fireworkCastles, 220);
    });

    // Reproducir sonido al abrir el modal (con fallback si el navegador bloquea autoplay)
    setTimeout(async () => {
      const ok = await playSuccessSound();
      if (!ok) {
        schedulePlayOnNextGesture();
        const unlockBtn = modal.querySelector('.purchase-success-sound-unlock');
        if (unlockBtn) {
          unlockBtn.style.display = 'inline-flex';
          unlockBtn.classList.add('show');
          unlockBtn.addEventListener(
            'click',
            async () => {
              await primeAudio();
              const played = await playSuccessSound();
              if (played) {
                unlockBtn.style.display = 'none';
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
          document.body.style.overflow = previousBodyOverflow;
          document.body.style.touchAction = previousBodyTouchAction;
        }
      }, 300);
    };

    // Scroll al producto
    const scrollToProduct = (idOverride = null) => {
      const targetId = idOverride || productId;
      const productCardByAnnouncementId = document.querySelector(
        `[data-announcement-id="${targetId}"]`
      );
      const secureDownloadBtn = document.querySelector(
        `[data-action="secureDownload"][data-product-id="${targetId}"]`
      );
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
