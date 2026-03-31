/**
 * AnnouncementUtils - helpers compartidos para anuncios (sin dependencias).
 * Fuente única: edita `src/js`; `public/js` se sincroniza con `npm run mirror:sync`.
 */

(function () {
  'use strict';
  const escapeHtml =
    globalThis.escapeHTML && typeof globalThis.escapeHTML === 'function'
      ? value => globalThis.escapeHTML(String(value ?? ''))
      : value =>
          String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

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
      const safeButtonId = escapeHtml(buttonId);
      const safeAnnouncementId = escapeHtml(announcementId);
      const safeProductId = escapeHtml(productId);
      const safeTimerId = escapeHtml(timerId);
      const safeDownloadsId = escapeHtml(downloadsId);
      const safeTitle = escapeHtml(title);
      const safeTimerText = escapeHtml(timerText);
      const safeDownloadsText = escapeHtml(downloadsText);
      const safeLabel = escapeHtml(label);
      const idAttr = safeButtonId ? ` id="${safeButtonId}"` : '';
      const timerIdAttr = safeTimerId ? ` id="${safeTimerId}"` : '';
      const downloadsIdAttr = safeDownloadsId ? ` id="${safeDownloadsId}"` : '';
      const titleAttr = safeTitle ? ` title="${safeTitle}"` : '';
      const disabledAttr = isExpired ? ' disabled aria-disabled="true"' : '';

      return `
        <button class="${normalizedButtonClass}"${idAttr}
                data-action="secureDownload"
                data-id="${safeAnnouncementId}"
                data-product-id="${safeProductId}"${titleAttr}${disabledAttr}>
          <div class="secure-download-content">
            <i data-lucide="shield-check" class="text-neon-green"></i>
            <span class="btn-text glitch-text" data-text="${safeLabel}">${safeLabel}</span>
          </div>
          <div class="secure-progress-bar"></div>
        </button>
        <div class="download-meta">
          <div class="download-timer-container">
            <i data-lucide="clock" class="icon-14"></i>
            <span${timerIdAttr} class="countdown-timer ${finalClass}" data-timer-for="${safeProductId}">${safeTimerText}</span>
          </div>
          <div class="download-counter-container">
            <i data-lucide="download" class="icon-14"></i>
            <span${downloadsIdAttr} class="downloads-counter ${finalClass}" data-downloads-for="${safeProductId}">${safeDownloadsText}</span>
          </div>
        </div>
      `;
    },
  };

  globalThis.AnnouncementUtils = utils;
})();
