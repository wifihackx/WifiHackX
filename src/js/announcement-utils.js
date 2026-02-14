/**
 * AnnouncementUtils - helpers compartidos para anuncios (sin dependencias).
 */

(function () {
  'use strict';

  const utils = {
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
  };

  globalThis.AnnouncementUtils = utils;
})();
