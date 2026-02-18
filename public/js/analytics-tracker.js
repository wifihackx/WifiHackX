/**
 * Analytics Tracker - WifiHackX
 * Registra visitas reales, dispositivos y fuentes de tráfico en Firestore.
 * Incluye detección de bots, rate limiting, respeto a consentimiento y manejo de errores.
 *
 * @version 2.0.0
 */

/* global performance, requestIdleCallback */

function initAnalyticsTracker() {
  'use strict';

  if (window.__ANALYTICS_TRACKER_INITED__) {
    return;
  }
  window.__ANALYTICS_TRACKER_INITED__ = true;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  const CONFIG = {
    // Rate Limiting
    MAX_VISITS_PER_WINDOW: 100,
    RATE_LIMIT_WINDOW_MS: 60000, // 60 seconds

    // Retry Logic
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
    RETRY_QUEUE_SIZE: 50,
    MAX_QUEUE_RETRY_ATTEMPTS: 10,

    // Feature Flags
    ENABLE_LOCALHOST_TRACKING: false,
    ALLOW_ADMIN_TRACKING_ON_LOCALHOST: false,
    ENABLE_BOT_DETECTION: true,
    ENABLE_RATE_LIMITING: true,
    ENABLE_CONSENT_CHECK: true,

    // Storage Keys
    SESSION_KEY: 'wifihackx_visit_tracked',
    RATE_LIMIT_KEY: 'wifihackx_rate_limit',
    RETRY_QUEUE_KEY: 'wifihackx_retry_queue',
  };

  // ============================================================================
  // BOT DETECTOR
  // ============================================================================
  /**
   * Detects bots and crawlers using user agent patterns and browser features
   */
  class BotDetector {
    /**
     * Check if the current visitor is a bot
     * @param {string} userAgent - User agent string
     * @param {Navigator} navigator - Navigator object
     * @returns {boolean} True if bot detected
     */
    static isBot(userAgent = navigator.userAgent, nav = navigator) {
      if (!CONFIG.ENABLE_BOT_DETECTION) return false;

      return (
        this.matchesBotPattern(userAgent) ||
        this.hasHeadlessIndicators(nav) ||
        !this.hasBrowserFeatures(nav)
      );
    }

    /**
     * Check if user agent matches known bot patterns
     * @param {string} userAgent - User agent string
     * @returns {boolean} True if matches bot pattern
     */
    static matchesBotPattern(userAgent) {
      const botPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /crawling/i,
        /googlebot/i,
        /bingbot/i,
        /slurp/i,
        /duckduckbot/i,
        /baiduspider/i,
        /yandexbot/i,
        /facebookexternalhit/i,
        /twitterbot/i,
        /rogerbot/i,
        /linkedinbot/i,
        /embedly/i,
        /quora link preview/i,
        /showyoubot/i,
        /outbrain/i,
        /pinterest\/0\./i,
        /developers\.google\.com\/\+\/web\/snippet/i,
        /slackbot/i,
        /vkshare/i,
        /w3c_validator/i,
        /redditbot/i,
        /applebot/i,
        /whatsapp/i,
        /flipboard/i,
        /tumblr/i,
        /bitlybot/i,
        /skypeuripreview/i,
        /nuzzel/i,
        /discordbot/i,
        /qwantify/i,
        /pinterestbot/i,
        /bitrix link preview/i,
        /xing-contenttabreceiver/i,
        /chrome-lighthouse/i,
        /telegrambot/i,
      ];

      return botPatterns.some(pattern => pattern.test(userAgent));
    }

    /**
     * Check for headless browser indicators
     * @param {Navigator} nav - Navigator object
     * @returns {boolean} True if headless indicators found
     */
    static hasHeadlessIndicators(nav) {
      // Check for common headless browser indicators
      if (nav.webdriver) return true;
      if (window.navigator.webdriver) return true;
      if (window.callPhantom || window._phantom) return true;
      if (window.Buffer) return true; // Node.js in browser context

      return false;
    }

    /**
     * Check if browser has expected features
     * @param {Navigator} nav - Navigator object
     * @returns {boolean} True if has browser features
     */
    static hasBrowserFeatures(nav) {
      // Check for basic browser APIs that bots often lack
      return !!(
        nav.languages &&
        nav.platform &&
        nav.userAgent &&
        window.screen &&
        window.screen.width &&
        window.screen.height
      );
    }
  }

  // ============================================================================
  // RATE LIMITER
  // ============================================================================
  /**
   * Rate limiter using sliding window algorithm
   */
  class RateLimiter {
    /**
     * @param {number} maxVisits - Maximum visits allowed in window
     * @param {number} windowMs - Time window in milliseconds
     */
    constructor(
      maxVisits = CONFIG.MAX_VISITS_PER_WINDOW,
      windowMs = CONFIG.RATE_LIMIT_WINDOW_MS
    ) {
      this.maxVisits = maxVisits;
      this.windowMs = windowMs;
      this.storageKey = CONFIG.RATE_LIMIT_KEY;
    }

    /**
     * Check if tracking is allowed (not rate limited)
     * @returns {boolean} True if can track
     */
    canTrack() {
      if (!CONFIG.ENABLE_RATE_LIMITING) return true;

      this.cleanup();
      const timestamps = this.getTimestamps();
      return timestamps.length < this.maxVisits;
    }

    /**
     * Record a visit timestamp
     */
    recordVisit() {
      if (!CONFIG.ENABLE_RATE_LIMITING) return;

      const timestamps = this.getTimestamps();
      timestamps.push(Date.now());
      this.saveTimestamps(timestamps);
    }

    /**
     * Remove expired timestamps outside the window
     */
    cleanup() {
      const now = Date.now();
      const cutoff = now - this.windowMs;
      const timestamps = this.getTimestamps();
      const validTimestamps = timestamps.filter(ts => ts > cutoff);
      this.saveTimestamps(validTimestamps);
    }

    /**
     * Get timestamps from localStorage
     * @returns {number[]} Array of timestamps
     */
    getTimestamps() {
      try {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
      } catch (_error) {
        return [];
      }
    }

    /**
     * Save timestamps to localStorage
     * @param {number[]} timestamps - Array of timestamps
     */
    saveTimestamps(timestamps) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(timestamps));
      } catch (_error) {
        // Quota exceeded or localStorage unavailable
        console.warn('Failed to save rate limit data:', _error);
      }
    }
  }

  // ============================================================================
  // ANALYTICS TRACKER
  // ============================================================================
  class AnalyticsTracker {
    constructor() {
      this.db = null;
      this.sessionKey = CONFIG.SESSION_KEY;
      this.rateLimiter = new RateLimiter();
      this.sessionId = this.generateSessionId();
      this.sessionStartedAt = Date.now();
      this.sessionPageViews = 1;
      this.engagementTracked = false;
      this.lastKnownUser = null;
      this.init();
    }

    async init() {
      // Esperar a que Firebase esté listo
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () =>
          this.waitForFirebase()
        );
      } else {
        this.waitForFirebase();
      }
    }

    waitForFirebase() {
      let attempts = 0;
      const maxAttempts = 50;
      const interval = setInterval(() => {
        attempts++;
        if (
          window.firebase &&
          window.firebase.apps &&
          window.firebase.apps.length > 0
        ) {
          clearInterval(interval);
          this.db = window.firebase.firestore();

          // Process any queued visits from previous failures
          this.processRetryQueue();

          // Track current visit
          this.trackVisit({ eventType: 'pageview' });
          this.setupSessionEndTracking();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          Logger.warn(
            'Firebase no detectado tras varios intentos.',
            'ANALYTICS'
          );
        }
      }, 200);
    }

    /**
     * Track a page visit with all validations
     */
    async trackVisit(options = {}) {
      const opts = {
        eventType: options.eventType || 'pageview',
        skipRateLimit: !!options.skipRateLimit,
        immediate: !!options.immediate,
        engagementTimeMs: Number(options.engagementTimeMs || 0),
        isBounce:
          typeof options.isBounce === 'boolean' ? options.isBounce : null,
        userOverride: options.userOverride || null,
      };
      // Use requestIdleCallback for non-blocking execution
      const performTracking = async () => {
        const startTime =
          typeof performance !== 'undefined' ? performance.now() : Date.now();

        try {
          // 1. Check localhost (configurable)
          const isLocal =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.protocol === 'file:';

          if (isLocal && !CONFIG.ENABLE_LOCALHOST_TRACKING) {
            Logger.debug('Localhost tracking disabled', 'ANALYTICS');
            return;
          }

          // 2. Bot Detection
          if (BotDetector.isBot()) {
            Logger.debug('Bot detected, visit not tracked', 'ANALYTICS');
            this.emitEvent('analytics:bot-detected', {
              userAgent: navigator.userAgent,
            });
            return;
          }

          // 3. Consent Check
          if (CONFIG.ENABLE_CONSENT_CHECK && !this.hasConsent()) {
            Logger.debug(
              'No analytics consent, visit not tracked',
              'ANALYTICS'
            );
            this.emitEvent('analytics:consent-blocked');
            return;
          }

          // 4. Rate Limiting
          if (!opts.skipRateLimit && !this.rateLimiter.canTrack()) {
            Logger.debug('Rate limit exceeded, visit not tracked', 'ANALYTICS');
            this.emitEvent('analytics:rate-limited');
            return;
          }

          // 5. Get user info
          const user = opts.userOverride || this.lastKnownUser || (await this.getUserInfo());
          this.lastKnownUser = user || null;

          // 6. Exclude admin (DISABLED for testing - track admins with flag)
          // Permitir tracking de admins en localhost para testing
          const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

          if (user && user.isAdmin) {
            if (
              !isLocalhost ||
              !CONFIG.ALLOW_ADMIN_TRACKING_ON_LOCALHOST
            ) {
              Logger.info(
                'Admin detectado, visita no registrada.',
                'ANALYTICS'
              );
              return;
            }
          }

          // 7. Collect visit metadata
          const visitData = this.getVisitMetadata(user, opts);

          // 8. Validate privacy compliance
          if (!this.validatePrivacyCompliance(visitData)) {
            Logger.error('Privacy compliance validation failed', 'ANALYTICS');
            return;
          }

          // 9. Write to Firestore with retry logic
          await this.writeVisitWithRetry(visitData);

          // 10. Record rate limit
          if (!opts.skipRateLimit) {
            this.rateLimiter.recordVisit();
          }

          const endTime =
            typeof performance !== 'undefined' ? performance.now() : Date.now();
          Logger.info(
            `Visita registrada: ${visitData.source} vía ${visitData.device} (${(endTime - startTime).toFixed(2)}ms)`,
            'ANALYTICS'
          );
        } catch (error) {
          Logger.error('Error al registrar visita', 'ANALYTICS', error);
          this.emitEvent('analytics:error', { error: error.message });
        }
      };

      // Use requestIdleCallback for non-blocking execution
      if (opts.immediate) {
        performTracking();
      } else if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(performTracking);
      } else {
        setTimeout(performTracking, 0);
      }
    }

    /**
     * Check if user has given consent for analytics
     * @returns {boolean} True if consent granted
     */
    hasConsent() {
      if (!window.ConsentManager) {
        // If no consent manager, assume consent (backwards compatibility)
        return true;
      }

      return window.ConsentManager.hasConsent('analytics');
    }

    /**
     * Get user information (authenticated or anonymous)
     * @returns {Promise<Object|null>} User object or null
     */
    async getUserInfo() {
      return new Promise(resolve => {
        // 1. Try AppState first (more efficient)
        if (window.AppState) {
          const currentState = window.AppState.getState('user');
          if (currentState) {
            resolve(currentState.isAuthenticated ? currentState : null);
            return;
          }

          // Subscribe to AppState
          const appStateUnsub = window.AppState.subscribe('user', u => {
            if (u) {
              appStateUnsub();
              resolve(u.isAuthenticated ? u : null);
            }
          });

          // Safety timeout
          setTimeout(() => {
            if (
              window.AppState &&
              window.AppState.getState('user') === undefined
            ) {
              resolve(null);
            }
          }, 2500);
          return;
        }

        // 2. Fallback to Firebase Auth
        if (!window.firebase || !window.firebase.auth) {
          resolve(null);
          return;
        }

        const timer = setTimeout(() => resolve(null), 2000);
        const unsubscribe = window.firebase.auth().onAuthStateChanged(async u => {
          clearTimeout(timer);
          unsubscribe();
          if (u && u.getIdTokenResult) {
            try {
              const claims = window.getAdminClaims
                ? await window.getAdminClaims(u, false)
                : (await u.getIdTokenResult(true)).claims;
              u.isAdmin =
                !!claims?.admin ||
                claims?.role === 'admin' ||
                claims?.role === 'super_admin';
            } catch (error) {
              Logger.warn('Error verificando admin en analytics', 'ANALYTICS', error);
            }
          }
          resolve(u);
        });
      });
    }

    /**
     * Collect visit metadata
     * @param {Object|null} user - User object or null
     * @returns {Object} Visit data object
     */
    getVisitMetadata(user, options = {}) {
      const eventType = options.eventType || 'pageview';
      const pageViewIndex =
        eventType === 'pageview' ? this.sessionPageViews : this.sessionPageViews;
      return {
        timestamp:
          window.firebase &&
          window.firebase.firestore &&
          window.firebase.firestore.FieldValue
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : new Date(),
        device: this.getDeviceType(),
        source: this.getTrafficSource(),
        path: window.location.pathname,
        userAgent: navigator.userAgent,
        userType: user ? 'authenticated' : 'anonymous',
        userId: user ? user.uid : null,
        isAdmin: user ? !!user.isAdmin : false, // Flag para identificar admins
        sessionId: this.sessionId,
        siteHost: window.location.hostname || '',
        eventType,
        engagementTimeMs:
          eventType === 'engagement'
            ? Math.max(0, Math.round(options.engagementTimeMs || 0))
            : 0,
        pageViewIndex,
        isBounce:
          typeof options.isBounce === 'boolean'
            ? options.isBounce
            : pageViewIndex <= 1,
        referrer: document.referrer || 'direct',
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        language: navigator.language || navigator.userLanguage,
      };
    }

    /**
     * Validate that visit data complies with privacy requirements
     * @param {Object} visitData - Visit data object
     * @returns {boolean} True if compliant
     */
    validatePrivacyCompliance(visitData) {
      // Ensure no IP address field
      if (visitData.ipAddress || visitData.ip) {
        return false;
      }

      // Ensure only standard user agent (no additional fingerprinting)
      const allowedFields = [
        'timestamp',
        'device',
        'source',
        'path',
        'userAgent',
        'userType',
        'userId',
        'sessionId',
        'siteHost',
        'referrer',
        'viewport',
        'language',
        'isAdmin', // ✅ AGREGADO: Permitir campo isAdmin
        'eventType',
        'engagementTimeMs',
        'pageViewIndex',
        'isBounce',
      ];

      const dataFields = Object.keys(visitData);
      const hasUnknownFields = dataFields.some(
        field => !allowedFields.includes(field)
      );

      if (hasUnknownFields) {
        // Log which fields are unknown for debugging
        const unknownFields = dataFields.filter(
          field => !allowedFields.includes(field)
        );
        Logger.warn(
          `Privacy compliance failed: unknown fields ${unknownFields.join(', ')}`,
          'ANALYTICS'
        );
      }

      return !hasUnknownFields;
    }

    /**
     * Write visit to Firestore with retry logic
     * @param {Object} visitData - Visit data object
     */
    async writeVisitWithRetry(visitData) {
      let lastError = null;

      for (let attempt = 0; attempt < CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          await this.db.collection('analytics_visits').add(visitData);
          return; // Success
        } catch (error) {
          lastError = error;
          Logger.warn(
            `Firestore write attempt ${attempt + 1} failed: ${error.message}`,
            'ANALYTICS'
          );

          // Wait before retry (exponential backoff)
          if (attempt < CONFIG.MAX_RETRY_ATTEMPTS - 1) {
            await new Promise(resolve =>
              setTimeout(resolve, CONFIG.RETRY_DELAYS[attempt])
            );
          }
        }
      }

      // All retries failed, queue for later
      Logger.error(
        'All retry attempts failed, queueing visit',
        'ANALYTICS',
        lastError
      );
      this.queueVisitForRetry(visitData, lastError);
    }

    /**
     * Queue a failed visit for retry later
     * @param {Object} visitData - Visit data object
     * @param {Error} error - Error that caused failure
     */
    queueVisitForRetry(visitData, error) {
      try {
        const queue = this.getRetryQueue();

        // Add to queue with metadata
        queue.push({
          visitData,
          error: error.message,
          attempts: 0,
          queuedAt: Date.now(),
        });

        // Limit queue size (FIFO)
        if (queue.length > CONFIG.RETRY_QUEUE_SIZE) {
          queue.shift(); // Remove oldest
        }

        this.saveRetryQueue(queue);
        Logger.info(
          `Visit queued for retry (queue size: ${queue.length})`,
          'ANALYTICS'
        );
      } catch (queueError) {
        Logger.error(
          'Failed to queue visit for retry',
          'ANALYTICS',
          queueError
        );
      }
    }

    /**
     * Process queued visits from previous failures
     */
    async processRetryQueue() {
      const queue = this.getRetryQueue();

      if (queue.length === 0) {
        return;
      }

      Logger.info(`Processing ${queue.length} queued visits`, 'ANALYTICS');

      const remainingQueue = [];

      for (const item of queue) {
        try {
          // Try to write the visit
          await this.db.collection('analytics_visits').add(item.visitData);
          Logger.info('Queued visit successfully written', 'ANALYTICS');
        } catch (_error) {
          // Increment attempt count
          item.attempts++;

          // Keep in queue if under max attempts
          if (item.attempts < CONFIG.MAX_QUEUE_RETRY_ATTEMPTS) {
            remainingQueue.push(item);
          } else {
            Logger.warn(
              `Dropping queued visit after ${item.attempts} attempts`,
              'ANALYTICS'
            );
          }
        }
      }

      this.saveRetryQueue(remainingQueue);
    }

    /**
     * Get retry queue from localStorage
     * @returns {Array} Queue array
     */
    getRetryQueue() {
      try {
        const data = localStorage.getItem(CONFIG.RETRY_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (_error) {
        return [];
      }
    }

    /**
     * Save retry queue to localStorage
     * @param {Array} queue - Queue array
     */
    saveRetryQueue(queue) {
      try {
        localStorage.setItem(CONFIG.RETRY_QUEUE_KEY, JSON.stringify(queue));
      } catch (_error) {
        Logger.warn('Failed to save retry queue', 'ANALYTICS', _error);
      }
    }

    setupSessionEndTracking() {
      const trackEngagementEnd = () => {
        if (this.engagementTracked) return;
        this.engagementTracked = true;
        const engagementTimeMs = Date.now() - this.sessionStartedAt;
        const isBounce = this.sessionPageViews <= 1 && engagementTimeMs < 15000;
        this.trackVisit({
          eventType: 'engagement',
          engagementTimeMs,
          isBounce,
          skipRateLimit: true,
          immediate: true,
          userOverride: this.lastKnownUser,
        });
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          trackEngagementEnd();
        }
      });
      window.addEventListener('pagehide', trackEngagementEnd);
      window.addEventListener('beforeunload', trackEngagementEnd);
    }

    /**
     * Generate a session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
      if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }

      // Fallback for browsers without crypto.randomUUID
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    /**
     * Emit custom event
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail
     */
    emitEvent(eventName, detail = {}) {
      try {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
      } catch (_error) {
        // Event emission failed, not critical
      }
    }

    /**
     * Get device type from user agent
     * @returns {string} Device type
     */
    getDeviceType() {
      const ua = navigator.userAgent;
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'Tablet';
      }
      if (
        /Mobile|android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
          ua
        )
      ) {
        return 'Móvil';
      }
      return 'Escritorio';
    }

    /**
     * Get traffic source from referrer
     * @returns {string} Traffic source
     */
    getTrafficSource() {
      const referrer = document.referrer;
      if (!referrer) return 'Directo';

      const url = new URL(referrer);
      const host = url.hostname.toLowerCase();

      const socialDomains = [
        'facebook.com',
        't.co',
        'twitter.com',
        'instagram.com',
        'linkedin.com',
        'pinterest.com',
        'youtube.com',
      ];

      if (socialDomains.some(domain => host.includes(domain))) {
        return 'Social';
      }

      if (host.includes(window.location.hostname)) {
        return 'Interno';
      }

      return 'Referidos';
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Initialize the tracker
  window.analyticsTrackerInstance = new AnalyticsTracker();

  // Listen for consent changes
  if (window.ConsentManager && window.ConsentManager.onConsentChange) {
    window.ConsentManager.onConsentChange(consents => {
      if (consents.analytics) {
        Logger.info('Analytics consent granted, tracking enabled', 'ANALYTICS');
      } else {
        Logger.info(
          'Analytics consent revoked, tracking disabled',
          'ANALYTICS'
        );
      }
    });
  }

  if (window.Logger) {
    Logger.info('Analytics tracker v2.0.0 loaded', 'ANALYTICS');
  }
}

if (typeof window !== 'undefined' && !window.__ANALYTICS_TRACKER_NO_AUTO__) {
  initAnalyticsTracker();
}

