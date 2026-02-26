/**
 * Static Pages Core JS
 * Versión: 1.0.0
 * Centraliza la lógica de animaciones y navegación para páginas estáticas
 */

(function () {
  'use strict';

  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || {
    UI: 'UI',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  // --- Network Background Animation ---
  const initNetworkAnimation = () => {
    const canvas = document.getElementById('network-bg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() {
        this.init();
      }
      init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const initParticles = () => {
      particles = [];
      const count = window.innerWidth < 768 ? 40 : 80;
      for (let i = 0; i < count; i++) particles.push(new Particle());
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.strokeStyle = `rgba(0, 242, 255, ${1 - dist / 150})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    initParticles();
    animate();
  };

  // --- Scroll Progress Logic ---
  const initScrollProgress = () => {
    const progressBar = document.getElementById('scroll-progress');
    if (!progressBar) return;

    const steps = [];
    for (let i = 0; i <= 100; i += 5) {
      steps.push(i);
    }
    const progressClasses = steps.map(step => `scroll-progress-${step}`);

    const updateProgress = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      const rounded = Math.min(100, Math.max(0, Math.round(scrolled / 5) * 5));
      progressBar.classList.remove(...progressClasses);
      progressBar.classList.add(`scroll-progress-${rounded}`);
    };

    window.addEventListener('scroll', updateProgress);
    updateProgress();
  };

  // --- Back Button Logic ---
  const initBackButton = () => {
    const backBtn = document.getElementById('backBtn');
    if (!backBtn) return;

    backBtn.addEventListener('click', e => {
      if (window.self === window.top) {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'index.html';
        }
      } else {
        e.preventDefault();
        try {
          if (window.parent && window.parent.FooterModals) {
            window.parent.FooterModals.closeModal(window.parent.FooterModals.currentModal);
          }
        } catch (err) {
          logSystem.warn('Failed to close parent modal', CAT.UI, err);
        }
      }
    });
  };

  // --- Initialize Everything ---
  const init = () => {
    initNetworkAnimation();
    initScrollProgress();
    initBackButton();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
