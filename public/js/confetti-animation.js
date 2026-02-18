/**
 * confetti-animation.js
 * Sistema de animación de confetti para celebraciones
 * Versión: 1.0.0
 * Lightweight, sin dependencias externas
 */

'use strict';

function setupConfettiAnimation() {

  class ConfettiAnimation {
    constructor() {
      this.particles = [];
      this.canvas = null;
      this.ctx = null;
      this.animationId = null;
      this.dpr = 1;
      this.dynamicQuality = 1;
      this.lastFrameTs = 0;
      this.slowFrameCount = 0;
      this.colors = [
        '#00ff88', // Verde neón (principal)
        '#00cc6a', // Verde oscuro
        '#00ffff', // Cyan
        '#ff00ff', // Magenta
        '#ffff00', // Amarillo
        '#ff0088', // Rosa
      ];
    }

    /**
     * Crea el canvas de confetti
     */
    createCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'confetti-canvas';
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      this.canvas.width = Math.floor(window.innerWidth * this.dpr);
      this.canvas.height = Math.floor(window.innerHeight * this.dpr);
      this.canvas.style.width = `${window.innerWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;

      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        return;
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      document.body.appendChild(this.canvas);
    }

    /**
     * Crea una partícula de confetti
     */
    createParticle(x, y) {
      return {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8, // Velocidad horizontal
        vy: Math.random() * -15 - 5, // Velocidad vertical (hacia arriba)
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: Math.random() * 8 + 4,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        gravity: 0.5,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      };
    }

    /**
     * Dibuja una partícula
     */
    drawParticle(particle) {
      if (!this.ctx) return;
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate((particle.rotation * Math.PI) / 180);

      this.ctx.fillStyle = particle.color;

      if (particle.shape === 'rect') {
        this.ctx.fillRect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size
        );
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    /**
     * Actualiza la posición de una partícula
     */
    updateParticle(particle) {
      particle.vy += particle.gravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      // Fade out cuando está cerca del suelo
      if (particle.y > window.innerHeight - 100) {
        particle.opacity -= 0.02;
      }

      return particle.opacity > 0 && particle.y < window.innerHeight + 50;
    }

    prefersReducedMotion() {
      return (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }

    getBaseQuality() {
      let quality = 1;
      const memory = navigator.deviceMemory || 8;
      const cores = navigator.hardwareConcurrency || 8;
      if (memory <= 4) quality *= 0.7;
      if (cores <= 4) quality *= 0.75;
      if (this.prefersReducedMotion()) quality *= 0.4;
      return Math.max(0.4, Math.min(1, quality));
    }

    getQuality() {
      const base = this.getBaseQuality();
      return Math.max(0.4, Math.min(1, base * this.dynamicQuality));
    }

    getMaxParticles() {
      return Math.max(120, Math.round(450 * this.getQuality()));
    }

    scaleCount(count) {
      return Math.max(8, Math.round(count * this.getQuality()));
    }

    clampToCapacity(count) {
      const capacity = this.getMaxParticles() - this.particles.length;
      if (capacity <= 0) return 0;
      return Math.min(count, capacity);
    }

    /**
     * Loop de animación
     */
    animate(ts = performance.now()) {
      if (!this.canvas || !this.ctx) {
        this.cleanup();
        return;
      }
      if (this.lastFrameTs) {
        const dt = ts - this.lastFrameTs;
        if (dt > 40) {
          this.slowFrameCount += 1;
          if (this.slowFrameCount >= 5) {
            this.dynamicQuality = Math.max(0.6, this.dynamicQuality - 0.1);
            this.slowFrameCount = 0;
          }
        } else {
          this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
        }
      }
      this.lastFrameTs = ts;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Actualizar y dibujar partículas
      this.particles = this.particles.filter(particle => {
        const isAlive = this.updateParticle(particle);
        if (isAlive) {
          this.drawParticle(particle);
        }
        return isAlive;
      });

      // Continuar animación si hay partículas
      if (this.particles.length > 0) {
        this.animationId = requestAnimationFrame(t => this.animate(t));
      } else {
        this.cleanup();
      }
    }

    /**
     * Lanza confetti desde una posición
     */
    launch(x, y, count = 50) {
      if (this.prefersReducedMotion()) return;
      if (!this.canvas || !this.ctx) {
        this.createCanvas();
      }
      if (!this.canvas || !this.ctx) return;

      // Crear partículas
      let scaled = this.scaleCount(count);
      scaled = this.clampToCapacity(scaled);
      for (let i = 0; i < scaled; i++) {
        this.particles.push(this.createParticle(x, y));
      }

      // Iniciar animación si no está corriendo
      if (!this.animationId) {
        this.animate();
      }
    }

    /**
     * Lanza confetti desde múltiples puntos (explosión)
     */
    burst(count = 100) {
      if (this.prefersReducedMotion()) return;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 3;

      this.launch(centerX, centerY, count);
    }

    /**
     * Lanza confetti desde los lados (lluvia)
     */
    rain(duration = 3000) {
      if (this.prefersReducedMotion()) return;
      if (!this.canvas || !this.ctx) {
        this.createCanvas();
      }
      if (!this.canvas || !this.ctx) return;

      const interval = 120; // Cada 120ms (ligeramente más liviano)
      let elapsed = 0;

      const rainInterval = setInterval(() => {
        // Lanzar desde posiciones aleatorias en la parte superior
        const x = Math.random() * window.innerWidth;
        const y = -20;

        const perTick = this.scaleCount(3);
        const spawn = this.clampToCapacity(perTick);
        for (let i = 0; i < spawn; i++) {
          this.particles.push(this.createParticle(x, y));
        }

        // Iniciar animación si no está corriendo
        if (!this.animationId) {
          this.animate();
        }

        elapsed += interval;
        if (elapsed >= duration) {
          clearInterval(rainInterval);
        }
      }, interval);
    }

    /**
     * Limpia el canvas y detiene la animación
     */
    cleanup() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
        this.canvas = null;
        this.ctx = null;
      }

      this.particles = [];
    }

    /**
     * Detiene la animación inmediatamente
     */
    stop() {
      this.particles = [];
      this.cleanup();
    }
  }

  // Exponer globalmente
  window.ConfettiAnimation = ConfettiAnimation;

  // Crear instancia global para uso fácil
  window.confetti = new ConfettiAnimation();

  console.log('[ConfettiAnimation] ✅ Sistema de confetti cargado');
}

function initConfettiAnimation() {
  if (window.__CONFETTI_ANIMATION_INITED__) {
    return;
  }

  window.__CONFETTI_ANIMATION_INITED__ = true;
  setupConfettiAnimation();
}

if (typeof window !== 'undefined' && !window.__CONFETTI_ANIMATION_NO_AUTO__) {
  initConfettiAnimation();
}

