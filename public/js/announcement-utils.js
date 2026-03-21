/**
 * AnnouncementUtils - helpers compartidos para anuncios (sin dependencias).
 * Fuente única: edita `src/js`; `public/js` se sincroniza con `npm run mirror:sync`.
 */

(function () {
  'use strict';

  const utils = {
    normalizeProductKey(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    },

    getProductKeys(ann) {
      if (!ann) return [];
      const keys = [];
      if (ann.id) keys.push(ann.id);
      if (ann.productId) keys.push(ann.productId);
      if (ann.stripeId) keys.push(ann.stripeId);
      if (ann.stripeProductId) keys.push(ann.stripeProductId);
      return keys.filter(Boolean);
    },

    normalizeTimestamp(value) {
      if (!value) return null;
      if (typeof value === 'number') return value;
      if (value instanceof Date) return value.getTime();
      if (typeof value.toMillis === 'function') return value.toMillis();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    },

    formatRemainingTime(remainingMs) {
      const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds
        .toString()
        .padStart(2, '0')}s`;
    },

    buildSecureDownloadMarkup({
      buttonClass = '',
      buttonId = '',
      announcementId = '',
      productId = '',
      timerId = '',
      downloadsId = '',
      timerText = 'Preparando...',
      downloadsText = 'N/A',
      label = 'DESCARGAR [SECURE]',
      isExpired = false,
      title = '',
    } = {}) {
      const acquiredClass = isExpired ? 'is-acquired' : '';
      const normalizedButtonClass = `${buttonClass} ${acquiredClass}`.trim();
      const finalClass = isExpired ? 'is-final' : '';
      const idAttr = buttonId ? ` id="${buttonId}"` : '';
      const timerIdAttr = timerId ? ` id="${timerId}"` : '';
      const downloadsIdAttr = downloadsId ? ` id="${downloadsId}"` : '';
      const titleAttr = title ? ` title="${title}"` : '';
      const disabledAttr = isExpired ? ' disabled aria-disabled="true"' : '';

      return `
        <button class="${normalizedButtonClass}"${idAttr}
                data-action="secureDownload"
                data-id="${announcementId}"
                data-product-id="${productId}"${titleAttr}${disabledAttr}>
          <div class="secure-download-content">
            <i data-lucide="shield-check" class="text-neon-green"></i>
            <span class="btn-text glitch-text" data-text="${label}">${label}</span>
          </div>
          <div class="secure-progress-bar"></div>
        </button>
        <div class="download-meta">
          <div class="download-timer-container">
            <i data-lucide="clock" class="icon-14"></i>
            <span${timerIdAttr} class="countdown-timer ${finalClass}" data-timer-for="${productId}">${timerText}</span>
          </div>
          <div class="download-counter-container">
            <i data-lucide="download" class="icon-14"></i>
            <span${downloadsIdAttr} class="downloads-counter ${finalClass}" data-downloads-for="${productId}">${downloadsText}</span>
          </div>
        </div>
      `;
    },
  };

  globalThis.AnnouncementUtils = utils;
})();
