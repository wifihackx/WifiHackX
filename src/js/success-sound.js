/**
 * success-sound.js
 * Sistema de sonido de éxito con permiso del usuario
 * Versión: 1.0.0
 */

'use strict';

function setupSuccessSound() {

  class SuccessSound {
    constructor() {
      this.audioContext = null;
      this.enabled = false;
      this.permissionAsked = false;
      this.loadPreference();
    }

    /**
     * Carga la preferencia del usuario desde localStorage
     */
    loadPreference() {
      try {
        const preference = localStorage.getItem('successSoundEnabled');
        if (preference !== null) {
          this.enabled = preference === 'true';
          this.permissionAsked = true;
        }
      } catch (error) {
        console.warn('[SuccessSound] No se pudo cargar preferencia:', error);
      }
    }

    /**
     * Guarda la preferencia del usuario en localStorage
     */
    savePreference(enabled) {
      try {
        localStorage.setItem('successSoundEnabled', enabled.toString());
        this.enabled = enabled;
        this.permissionAsked = true;
      } catch (error) {
        console.warn('[SuccessSound] No se pudo guardar preferencia:', error);
      }
    }

    /**
     * Pregunta al usuario si quiere habilitar sonidos
     */
    async askPermission() {
      if (this.permissionAsked) {
        return this.enabled;
      }

      // Mostrar modal de permiso personalizado
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'success-sound-overlay';

        const modal = document.createElement('div');
        modal.className = 'success-sound-modal';

        modal.innerHTML = `
          <div class="success-sound-modal__icon" aria-hidden="true">🔊</div>
          <h3 class="success-sound-modal__title">Sonidos de Éxito</h3>
          <p class="success-sound-modal__message">
            ¿Quieres escuchar un sonido de celebración cuando completes una compra?
          </p>
          <div class="success-sound-modal__actions">
            <button id="sound-yes" class="success-sound-modal__btn success-sound-modal__btn--primary">Sí, habilitar</button>
            <button id="sound-no" class="success-sound-modal__btn success-sound-modal__btn--secondary">No, gracias</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const handleChoice = enabled => {
          this.savePreference(enabled);
          overlay.remove();
          resolve(enabled);
        };

        modal.querySelector('#sound-yes').addEventListener('click', () => {
          handleChoice(true);
        });

        modal.querySelector('#sound-no').addEventListener('click', () => {
          handleChoice(false);
        });
      });
    }

    /**
     * Inicializa el AudioContext
     */
    initAudioContext() {
      if (!this.audioContext) {
        try {
          this.audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();
        } catch (error) {
          console.warn('[SuccessSound] AudioContext no disponible:', error);
          return false;
        }
      }
      return true;
    }

    /**
     * Genera un tono de éxito (melodía ascendente)
     */
    playSuccessTone() {
      if (!this.initAudioContext()) return;

      const now = this.audioContext.currentTime;

      // Notas de la melodía (frecuencias en Hz)
      const notes = [
        { freq: 523.25, time: 0, duration: 0.15 }, // C5
        { freq: 659.25, time: 0.15, duration: 0.15 }, // E5
        { freq: 783.99, time: 0.3, duration: 0.3 }, // G5
      ];

      notes.forEach(note => {
        // Crear oscilador
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Configurar tono
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.freq, now + note.time);

        // Envelope (fade in/out)
        gainNode.gain.setValueAtTime(0, now + note.time);
        gainNode.gain.linearRampToValueAtTime(0.3, now + note.time + 0.05);
        gainNode.gain.linearRampToValueAtTime(
          0,
          now + note.time + note.duration
        );

        // Reproducir
        oscillator.start(now + note.time);
        oscillator.stop(now + note.time + note.duration);
      });
    }

    /**
     * Reproduce el sonido de éxito (con permiso)
     */
    async play() {
      // Si no se ha preguntado, preguntar ahora
      if (!this.permissionAsked) {
        const granted = await this.askPermission();
        if (!granted) {
          console.log('[SuccessSound] Usuario rechazó sonidos');
          return;
        }
      }

      // Si está habilitado, reproducir
      if (this.enabled) {
        this.playSuccessTone();
        console.log('[SuccessSound] ✅ Sonido de éxito reproducido');
      }
    }

    /**
     * Habilita los sonidos
     */
    enable() {
      this.savePreference(true);
      console.log('[SuccessSound] ✅ Sonidos habilitados');
    }

    /**
     * Deshabilita los sonidos
     */
    disable() {
      this.savePreference(false);
      console.log('[SuccessSound] ❌ Sonidos deshabilitados');
    }

    /**
     * Verifica si los sonidos están habilitados
     */
    isEnabled() {
      return this.enabled;
    }
  }

  // Exponer globalmente
  window.SuccessSound = SuccessSound;

  // Crear instancia global
  window.successSound = new SuccessSound();

  console.log('[SuccessSound] ✅ Sistema de sonido cargado');
}

export function initSuccessSound() {
  if (window.__SUCCESS_SOUND_INITED__) {
    return;
  }

  window.__SUCCESS_SOUND_INITED__ = true;
  setupSuccessSound();
}

if (typeof window !== 'undefined' && !window.__SUCCESS_SOUND_NO_AUTO__) {
  initSuccessSound();
}

