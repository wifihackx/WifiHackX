/**
 * Admin Audit Renderer
 * Gestiona la visualización del panel de auditoría de seguridad en tiempo real.
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupAdminAuditRenderer() {
  const SUCCESSFUL_PURCHASE_STATUSES = new Set([
    'completed',
    'complete',
    'paid',
    'succeeded',
    'success',
    'approved',
    'captured',
    'authorized',
    'active',
  ]);

  async function getAdminAllowlist() {
    if (window.AdminSettingsService?.getAllowlist) {
      return window.AdminSettingsService.getAllowlist({ allowDefault: false });
    }
    const emails = (window.AdminSettingsCache?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (window.AdminSettingsCache?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  }

  async function isAdminUser(user) {
    if (!user) return false;
    if (window.AppState?.state?.user?.isAdmin === true) return true;
    const allowlist = await getAdminAllowlist();
    if (user.email && allowlist.emails.includes(user.email.toLowerCase())) {
      return true;
    }
    if (allowlist.uids.includes(user.uid)) {
      return true;
    }
    if (user.getIdTokenResult) {
      try {
        const claims = window.getAdminClaims
          ? await window.getAdminClaims(user, false)
          : (await user.getIdTokenResult(true)).claims;
        return !!claims?.admin || claims?.role === 'admin' || claims?.role === 'super_admin';
      } catch (error) {
        console.warn('[AdminAuditRenderer] Error verificando claims:', error);
      }
    }
    return false;
  }

  class AdminAuditRenderer {
    constructor() {
      this.containerId = 'adminAuditSection';
      this.tableBodyId = 'audit-logs-body';
      this.logs = [];
      this.filteredLogs = [];
      this.unsubscribe = null; // Firestore listener
      this.alertsUnsubscribe = null; // Alerts listener
      this.diagnosticsUnsubscribe = null; // Diagnostics listener
      this.fallbackUnsubscribe = null; // Fallback listener
      this.userProfileCache = new Map();
      this.ipCountryCache = new Map();
      this.initialized = false;
      this.timeFilter = '24h';
      this.queryFilters = {
        ip: '',
        uid: '',
        email: '',
        type: 'all',
        action: '',
        risk: 'all',
        from: '',
        to: '',
      };
      this._logoutCleanupBound = false;
      this.handlersRegistered = false;
      this.localActionsBound = false;
      this.localActionsHandler = null;
      this.localActionsContainer = null;
      this.sessionIpCache = null;
      this.sessionIpPromise = null;
    }

    runSafely(label, fn, fallback = null) {
      try {
        return fn();
      } catch (error) {
        console.error(`[AdminAuditRenderer] ${label}:`, error);
        return fallback;
      }
    }

    isSuccessfulPurchaseStatus(status) {
      const normalized = String(status || 'completed')
        .trim()
        .toLowerCase();
      return SUCCESSFUL_PURCHASE_STATUSES.has(normalized);
    }

    mapPurchaseToAuditLog(id, data = {}, fallbackUserId = '') {
      const userId = String(data.userId || fallbackUserId || '').trim();
      const currentUser = window.firebase?.auth?.().currentUser || null;
      const userEmail =
        data.userEmail ||
        data.email ||
        (currentUser && currentUser.uid === userId ? currentUser.email : '') ||
        'Usuario desconocido';
      const ip =
        data.ip || data.clientIp || data.client_ip || data.ipAddress || data.lastIP || 'N/A';
      const countryCode = String(
        data.countryCode || data.country_code || data.geo?.countryCode || ''
      ).trim();
      return {
        id: `purchase_${id}`,
        type: data.type || 'purchase',
        purchaseId: id,
        userId: userId || null,
        userEmail,
        productName: data.productName || data.productTitle || data.productId || 'Producto',
        productId: data.productId || null,
        timestamp:
          data.createdAt ||
          data.timestamp ||
          data.purchasedAt ||
          data.completedAt ||
          data.updatedAt ||
          null,
        ip,
        ipSource:
          data.ip || data.clientIp || data.client_ip || data.ipAddress
            ? 'purchase'
            : currentUser && currentUser.uid === userId
              ? 'session'
              : 'unknown',
        geo: {
          location:
            data.country ||
            data.countryName ||
            data.geo?.country ||
            data.geo?.location ||
            data.location ||
            (ip !== 'N/A' ? 'Sin país (solo IP)' : 'Desconocido'),
          flag: this.countryCodeToFlag(countryCode),
          isp: data.isp || data.provider || data.source || 'N/A',
        },
        action: 'purchase',
        riskLevel: 'low',
        rawData: data,
      };
    }

    async appendRecentPurchasesFromFallback(baseLogs) {
      if (!window.firebase || !Array.isArray(baseLogs)) return;
      const db = firebase.firestore();
      const purchaseLogs = [];
      const seenSyntheticIds = new Set();

      try {
        const ordersSnapshot = await db
          .collection('orders')
          .orderBy('createdAt', 'desc')
          .limit(30)
          .get();
        ordersSnapshot.forEach(doc => {
          const data = doc.data() || {};
          if (!this.isSuccessfulPurchaseStatus(data.status)) return;
          purchaseLogs.push(this.mapPurchaseToAuditLog(doc.id, data));
        });
      } catch (_ordersError) {}

      if (purchaseLogs.length === 0) {
        try {
          if (typeof db.collectionGroup === 'function') {
            const cgSnapshot = await db.collectionGroup('purchases').limit(100).get();
            cgSnapshot.forEach(doc => {
              const data = doc.data() || {};
              if (!this.isSuccessfulPurchaseStatus(data.status)) return;
              const pathParts = String(doc.ref.path || '').split('/');
              const uid = pathParts.length >= 4 ? pathParts[1] : '';
              purchaseLogs.push(this.mapPurchaseToAuditLog(doc.id, data, uid));
            });
          }
        } catch (_cgError) {}
      }

      if (purchaseLogs.length === 0) {
        try {
          if (window.firebase?.functions) {
            const callable = window.firebase.functions().httpsCallable('getAdminPurchasesList');
            const result = await callable({ limit: 200 });
            const rows = Array.isArray(result?.data?.purchases) ? result.data.purchases : [];

            rows.forEach((row, idx) => {
              const status = String(row?.status || 'completed')
                .toLowerCase()
                .trim();
              if (!this.isSuccessfulPurchaseStatus(status)) return;
              const purchaseId = String(
                row?.id || row?.purchaseId || row?.sessionId || `callable_${idx}`
              ).trim();
              purchaseLogs.push(
                this.mapPurchaseToAuditLog(
                  purchaseId,
                  {
                    type: row?.type || 'purchase',
                    userId: row?.userId || '',
                    userEmail: row?.userEmail || row?.email || '',
                    productId: row?.productId || '',
                    productName:
                      row?.productTitle || row?.productName || row?.productId || 'Producto',
                    status: status,
                    purchasedAt:
                      row?.createdAtMs ||
                      row?.createdAt ||
                      row?.timestamp ||
                      row?.purchasedAt ||
                      null,
                    ip: row?.ip || row?.clientIp || row?.lastIP || undefined,
                    countryCode: row?.countryCode || row?.country_code || undefined,
                    country: row?.country || row?.countryName || undefined,
                    isp: row?.provider || row?.isp || row?.source || undefined,
                  },
                  row?.userId || ''
                )
              );
            });
          }
        } catch (_callablePurchasesError) {}
      }

      if (purchaseLogs.length === 0) {
        try {
          const usersSnapshot = await db.collection('users').limit(250).get();
          usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() || {};
            const uid = String(userDoc.id || userData.uid || '').trim();
            const email = String(userData.email || '').trim();
            const purchases = Array.isArray(userData.purchases) ? userData.purchases : [];
            const purchaseMeta =
              userData.purchaseMeta && typeof userData.purchaseMeta === 'object'
                ? userData.purchaseMeta
                : {};

            purchases.forEach((rawProductId, idx) => {
              const productId = String(rawProductId || '').trim();
              if (!productId) return;
              const meta = purchaseMeta[productId] || {};
              const syntheticId = `user_array_${uid}_${productId}_${idx}`;
              if (seenSyntheticIds.has(syntheticId)) return;
              seenSyntheticIds.add(syntheticId);

              purchaseLogs.push(
                this.mapPurchaseToAuditLog(
                  syntheticId,
                  {
                    userId: uid,
                    userEmail: email || undefined,
                    productId: productId,
                    productName: meta.productName || meta.productTitle || productId,
                    status: meta.status || 'completed',
                    purchasedAt:
                      meta.purchasedAt ||
                      meta.createdAt ||
                      userData.updatedAt ||
                      userData.createdAt ||
                      null,
                    ip: meta.ip || userData.lastIP || userData.lastIp || userData.ip || undefined,
                    countryCode:
                      meta.countryCode ||
                      userData.countryCode ||
                      userData.geo?.countryCode ||
                      undefined,
                    country:
                      meta.country ||
                      userData.country ||
                      userData.countryName ||
                      userData.geo?.country ||
                      undefined,
                    isp: meta.isp || userData.isp || userData.network || undefined,
                  },
                  uid
                )
              );
            });
          });
        } catch (_usersArrayError) {}
      }

      if (purchaseLogs.length === 0) {
        try {
          const currentUser = window.firebase?.auth?.().currentUser || null;
          const uid = String(currentUser?.uid || '').trim();
          if (uid) {
            const ownSnapshot = await db
              .collection('users')
              .doc(uid)
              .collection('purchases')
              .limit(50)
              .get();
            ownSnapshot.forEach(doc => {
              const data = doc.data() || {};
              if (!this.isSuccessfulPurchaseStatus(data.status)) return;
              purchaseLogs.push(this.mapPurchaseToAuditLog(doc.id, data, uid));
            });
          }
        } catch (_ownError) {}
      }

      if (purchaseLogs.length === 0) return;

      const existingPurchaseIds = new Set(
        baseLogs.map(log => String(log?.purchaseId || '').trim()).filter(Boolean)
      );

      purchaseLogs.forEach(log => {
        const pid = String(log.purchaseId || '').trim();
        if (pid && existingPurchaseIds.has(pid)) return;
        baseLogs.push(log);
        if (pid) existingPurchaseIds.add(pid);
      });

      baseLogs.sort((a, b) => this.getLogTimestampMs(b) - this.getLogTimestampMs(a));
    }

    async getCurrentSessionIp() {
      if (this.sessionIpCache) return this.sessionIpCache;
      if (this.sessionIpPromise) return this.sessionIpPromise;

      this.sessionIpPromise = (async () => {
        try {
          const response = await fetch('https://api.ipify.org?format=json');
          if (!response.ok) return '';
          const payload = await response.json();
          const ip = String(payload?.ip || '').trim();
          this.sessionIpCache = ip;
          return ip;
        } catch (_e) {
          return '';
        } finally {
          this.sessionIpPromise = null;
        }
      })();

      return this.sessionIpPromise;
    }

    async enrichCurrentUserMissingIp(logs) {
      if (!Array.isArray(logs) || logs.length === 0) return;
      const currentUser = window.firebase?.auth?.().currentUser || null;
      if (!currentUser?.uid) return;

      const needsSessionIp = logs.some(log => {
        const uid = String(log?.userId || '').trim();
        const email = String(log?.userEmail || '')
          .trim()
          .toLowerCase();
        const isCurrent =
          (uid && uid === currentUser.uid) ||
          (!!currentUser.email && email === String(currentUser.email).toLowerCase());
        const ip = String(log?.ip || '').trim();
        return isCurrent && (!ip || ip === 'N/A' || ip === 'unknown');
      });

      if (!needsSessionIp) return;
      const sessionIp = await this.getCurrentSessionIp();
      if (!sessionIp) return;

      logs.forEach(log => {
        const uid = String(log?.userId || '').trim();
        const email = String(log?.userEmail || '')
          .trim()
          .toLowerCase();
        const isCurrent =
          (uid && uid === currentUser.uid) ||
          (!!currentUser.email && email === String(currentUser.email).toLowerCase());
        if (!isCurrent) return;
        const ip = String(log?.ip || '').trim();
        if (ip && ip !== 'N/A' && ip !== 'unknown') return;
        log.ip = sessionIp;
        log.ipSource = 'session';
        log.geo = log.geo || {};
        if (!log.geo.location || String(log.geo.location).toLowerCase() === 'desconocido') {
          log.geo.location = 'Sin país (solo IP)';
        }
      });
    }

    /**
     * Inicializa el renderer
     */
    async init() {
      if (this.initialized) {
        debugLog('[AdminAuditRenderer] ℹ️ Ya inicializado. Saltando.');
        return;
      }

      debugLog('[AdminAuditRenderer] 🚀 Iniciando inicialización del monitor de seguridad...');

      // Security Check: Verify Admin UID
      if (!window.firebase || !window.firebase.auth()) {
        debugLog('[AdminAuditRenderer] ⏳ Esperando a Firebase Auth...');
        return;
      }

      const user = window.firebase.auth().currentUser;

      if (!user) {
        debugLog('[AdminAuditRenderer] ⛔ No hay usuario autenticado. Cancelando.');
        this.initialized = false;
        return;
      }

      if (!this._logoutCleanupBound) {
        this._logoutCleanupBound = true;
        window.addEventListener('auth:logout', () => {
          try {
            if (this.unsubscribe) this.unsubscribe();
            if (this.alertsUnsubscribe) this.alertsUnsubscribe();
            if (this.diagnosticsUnsubscribe) this.diagnosticsUnsubscribe();
            if (this.fallbackUnsubscribe) this.fallbackUnsubscribe();
          } catch (_e) {}
          this.unsubscribe = null;
          this.alertsUnsubscribe = null;
          this.diagnosticsUnsubscribe = null;
          this.fallbackUnsubscribe = null;
          this.resetUiBindings();
          this.initialized = false;
        });
      }

      // Verificar si el usuario es administrador (vía AppState o claims)
      const isAdmin = await isAdminUser(user);

      if (!isAdmin) {
        debugLog(
          `[AdminAuditRenderer] ⛔ Acceso denegado: Usuario ${user.email} no es administrador.`
        );
        return;
      }

      debugLog('[AdminAuditRenderer] ✅ Permisos de administrador verificados.');

      // Verificar que Firebase esté disponible
      if (!window.firebase) {
        console.error(
          '[AdminAuditRenderer] ❌ Firebase no está disponible. Abortando inicialización.'
        );
        return;
      }

      debugLog('[AdminAuditRenderer] ✅ Firebase disponible');

      // Inyectar el contenedor si no existe
      this.ensureContainer();

      // Verificar que el contenedor se creó correctamente
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error('[AdminAuditRenderer] ❌ No se pudo crear el contenedor. Abortando.');
        return;
      }

      debugLog('[AdminAuditRenderer] ✅ Contenedor verificado en DOM');

      // Enlazar acciones del panel desde el inicio, aunque no haya filas.
      this.bindEvents();

      // Iniciar listeners
      this.cleanupListeners();
      this.subscribeToLogs();
      this.subscribeToAlerts();
      this.subscribeToDiagnostics();

      this.initialized = true;
      debugLog('[AdminAuditRenderer] ✅ Inicialización completada');
    }

    ensureInteractive() {
      this.ensureContainer();
      this.bindEvents();
      // Re-render defensivo para asegurar estado visual coherente.
      this.applyFilter();
    }

    /**
     * Asegura que el contenedor HTML exista en el dashboard
     */
    ensureContainer() {
      // Buscar el contenedor del dashboard (dashboardSection es el correcto)
      const dashboardSection = document.getElementById('dashboardSection');

      if (!dashboardSection) {
        console.error(
          '[AdminAuditRenderer] ❌ No se encontró #dashboardSection. El dashboard no está disponible.'
        );
        return;
      }

      debugLog('[AdminAuditRenderer] ✅ Contenedor del dashboard encontrado');

      // Verificar si ya existe
      if (document.getElementById(this.containerId)) {
        debugLog('[AdminAuditRenderer] ℹ️ Monitor ya existe en el DOM');
        return;
      }

      const auditHTML = `
                <div id="${this.containerId}" class="admin-audit-card">
                    <div class="card-header">
                        <div class="card-header-left">
                            <h3>
                                <i data-lucide="shield-alert"></i>
                                Monitor de Fraude en Tiempo Real
                            </h3>
                            <span class="badge-live">LIVE</span>
                            <span id="audit-alert-badge" class="badge-alert hidden" title="Click para marcar como leídas">0 alertas</span>
                            <span id="audit-diagnostics-badge" class="badge-diagnostics hidden" title="Diagnósticos últimas 24h">0 diag 24h</span>
                        </div>
                        <div class="audit-filters" role="group" aria-label="Filtros de tiempo">
                            <button class="audit-filter-btn active" data-filter="1h">1h</button>
                            <button class="audit-filter-btn" data-filter="24h">24h</button>
                            <button class="audit-filter-btn" data-filter="7d">7d</button>
                            <button class="audit-filter-btn" data-filter="all">Todo</button>
                        </div>
                        <div class="audit-header-actions">
                            <button class="btn-export-logs" data-action="adminExportIntrusionLogsJson" title="Descargar logs completos en JSON">
                                <i data-lucide="download"></i>
                                JSON
                            </button>
                            <button class="btn-export-logs" data-action="adminExportIntrusionLogsCsv" title="Descargar logs en CSV">
                                <i data-lucide="file-spreadsheet"></i>
                                CSV
                            </button>
                            <button class="btn-clear-all" data-action="adminClearAllLogs" title="Limpiar todos los logs">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Limpiar Todo
                            </button>
                        </div>
                    </div>
                    <div class="audit-advanced-filters" role="group" aria-label="Filtros avanzados de intrusión">
                        <input type="text" class="audit-filter-input" id="auditFilterIp" placeholder="Filtrar por IP">
                        <input type="text" class="audit-filter-input" id="auditFilterUid" placeholder="Filtrar por UID">
                        <input type="text" class="audit-filter-input" id="auditFilterEmail" placeholder="Filtrar por email">
                        <select class="audit-filter-select" id="auditFilterType">
                            <option value="all">Tipo: Todos</option>
                            <option value="admin_action">Tipo: Admin Action</option>
                            <option value="registration_blocked">Tipo: Registro bloqueado</option>
                            <option value="download_attempt_blocked">Tipo: Intento bloqueado</option>
                        </select>
                        <input type="text" class="audit-filter-input" id="auditFilterAction" placeholder="Filtrar por acción/actor">
                        <select class="audit-filter-select" id="auditFilterRisk">
                            <option value="all">Riesgo: Todos</option>
                            <option value="high">Riesgo: Alto</option>
                            <option value="medium">Riesgo: Medio</option>
                            <option value="low">Riesgo: Bajo</option>
                        </select>
                        <input type="date" class="audit-filter-date" id="auditFilterFrom" title="Desde fecha">
                        <input type="date" class="audit-filter-date" id="auditFilterTo" title="Hasta fecha">
                        <button class="btn-export-logs" data-action="adminClearIntrusionFilters" title="Limpiar filtros avanzados">Limpiar filtros</button>
                    </div>
                    <div class="audit-table-container">
                        <table class="audit-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Producto</th>
                                    <th>Ubicación (IP)</th>
                                    <th>ISP / Red</th>
                                    <th>Riesgo</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="${this.tableBodyId}">
                                <tr>
                                    <td colspan="6" class="audit-empty">Cargando datos de seguridad...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

      // Insertar después de las stats cards
      const statsContainer = document.getElementById('dashboardStatsContainer');
      if (statsContainer) {
        debugLog('[AdminAuditRenderer] 📍 Insertando Monitor después de dashboardStatsContainer');
        statsContainer.insertAdjacentHTML('afterend', auditHTML);
      } else {
        debugLog('[AdminAuditRenderer] 📍 Insertando Monitor al final del dashboardSection');
        dashboardSection.insertAdjacentHTML('beforeend', auditHTML);
      }

      debugLog('[AdminAuditRenderer] ✅ HTML del Monitor insertado en el DOM');

      // Inicializar iconos
      if (window.lucide) {
        window.lucide.createIcons();
        debugLog('[AdminAuditRenderer] ✅ Iconos Lucide inicializados');
      }
    }

    /**
     * Se suscribe a los cambios en la colección de logs/compras
     */
    subscribeToLogs() {
      if (!window.firebase) return;

      const db = firebase.firestore();

      debugLog(
        '[AdminAuditRenderer] 🔥 Configurando listener en tiempo real para logs de seguridad...'
      );

      // OPCIÓN 1: Intentar colección dedicada 'security_logs' (recomendado para producción)
      this.unsubscribe = db
        .collection('security_logs')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(
          async snapshot => {
            debugLog(
              `[AdminAuditRenderer] 📊 [TIEMPO REAL] ${snapshot.size} logs de seguridad detectados`
            );

            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data();

              // Extraer IP de múltiples fuentes posibles
              const ipAddress =
                data.ip ||
                data.clientIp ||
                data.client_ip ||
                data.ipAddress ||
                data.ip_address ||
                data.customer_ip ||
                data.lastIP ||
                'N/A';

              // Extraer información de geolocalización
              // CRÍTICO: NO usar data.locale como fallback (puede ser "auto")
              // Prioridad: geo.location > country > "Desconocido"
              const geoData = data.geo || data.location || {};
              const location = geoData.location || data.country || 'Desconocido';
              const isp = geoData.isp || data.isp || data.payment_method || 'N/A';
              let ipSource = data.ipSource || data.ip_source || data.ipOrigin || 'unknown';

              // Inferir fuente si hay IP válida pero ipSource no existe (logs antiguos)
              if (
                ipSource === 'unknown' &&
                ipAddress &&
                ipAddress !== 'N/A' &&
                ipAddress !== 'unknown'
              ) {
                ipSource = 'firestore';
              }

              this.logs.push({
                id: doc.id,
                type: data.type || data.eventType || data.action || 'unknown',
                level: data.level || null,
                actorUid: data.actorUid || null,
                actorEmail: data.actorEmail || null,
                purchaseId: data.purchaseId || doc.id,
                userId: data.userId || null,
                userEmail: data.userEmail || data.email || 'Anónimo',
                productName:
                  data.productName || data.productTitle || data.product || 'Producto Desconocido',
                timestamp: data.timestamp || data.createdAt,
                ip: ipAddress,
                ipSource: ipSource,
                geo: {
                  location: location,
                  flag: geoData.flag || null,
                  isp: isp,
                },
                action: data.action || data.eventType || 'unknown',
                riskLevel: data.riskLevel || null,
                productId: data.productId || null,
                rawData: data,
              });
            });

            if (this.logs.length === 0) {
              this.subscribeToOrdersFallback();
              return;
            }

            await this.appendRecentPurchasesFromFallback(this.logs);
            await this.enrichCurrentUserMissingIp(this.logs);
            await this.enrichMissingCountries(this.logs);
            this.applyFilter();
          },
          error => {
            // Si es error de permisos, degradar a fallback de compras.
            if (error.code === 'permission-denied') {
              console.warn(
                '[AdminAuditRenderer] ⛔ Sin acceso a security_logs. Activando fallback de compras.'
              );
              this.subscribeToOrdersFallback();
              return;
            }

            console.warn(
              '[AdminAuditRenderer] Error en listener de security_logs, intentando con orders fallback...',
              error
            );

            // OPCIÓN 2: Fallback a datos de compras/pedidos
            this.subscribeToOrdersFallback();
          }
        );
    }

    /**
     * Se suscribe a alertas diagnósticas (IP unknown)
     */
    subscribeToAlerts() {
      if (!window.firebase) return;

      const db = firebase.firestore();

      if (this.alertsUnsubscribe) {
        this.alertsUnsubscribe();
      }

      this.alertsUnsubscribe = db
        .collection('alerts')
        .where('type', '==', 'security_diagnostic')
        .where('read', '==', false)
        .limit(25)
        .onSnapshot(
          async snapshot => {
            const badge = document.getElementById('audit-alert-badge');
            if (!badge) return;

            const count = snapshot.size;
            if (count > 0) {
              badge.textContent = `${count} alerta${count > 1 ? 's' : ''}`;
              badge.classList.remove('hidden');
            } else {
              badge.classList.add('hidden');
            }

            // Click para marcar alertas como leídas
            if (!badge.dataset.bound) {
              badge.dataset.bound = 'true';
              badge.addEventListener('click', () => this.markAlertsRead());
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              debugLog('[AdminAuditRenderer] ⛔ Sin permisos para leer alerts.');
              return;
            }
            console.warn('[AdminAuditRenderer] Error leyendo alerts:', error);
          }
        );
    }

    /**
     * Conteo de diagnósticos recientes (últimas 24h)
     */
    subscribeToDiagnostics() {
      if (!window.firebase) return;

      const db = firebase.firestore();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (this.diagnosticsUnsubscribe) {
        this.diagnosticsUnsubscribe();
      }

      this.diagnosticsUnsubscribe = db
        .collection('security_logs_diagnostics')
        .where('timestamp', '>=', since)
        .limit(200)
        .onSnapshot(
          async snapshot => {
            const badge = document.getElementById('audit-diagnostics-badge');
            if (!badge) return;

            const count = snapshot.size;
            if (count > 0) {
              badge.textContent = `${count} diag 24h`;
              badge.classList.remove('hidden');
            } else {
              badge.classList.add('hidden');
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              debugLog('[AdminAuditRenderer] ⛔ Sin permisos para leer diagnósticos.');
              return;
            }
            console.warn('[AdminAuditRenderer] Error leyendo diagnósticos:', error);
          }
        );
    }

    /**
     * Marca alertas de diagnóstico como leídas
     */
    async markAlertsRead() {
      try {
        const db = firebase.firestore();
        const snapshot = await db
          .collection('alerts')
          .where('type', '==', 'security_diagnostic')
          .where('read', '==', false)
          .limit(25)
          .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { read: true });
        });

        await batch.commit();
        debugLog('[AdminAuditRenderer] ✅ Alertas marcadas como leídas');
      } catch (error) {
        console.warn('[AdminAuditRenderer] Error marcando alertas:', error);
      }
    }

    /**
     * Fallback: Suscribirse a purchases con logs de seguridad
     */
    subscribeToPurchasesLogs() {
      const db = firebase.firestore();

      this.fallbackUnsubscribe = db
        .collection('purchases')
        .where('hasSecurityLogs', '==', true)
        .limit(20)
        .onSnapshot(
          async snapshot => {
            debugLog(
              `[AdminAuditRenderer] 📊 [TIEMPO REAL] ${snapshot.size} compras con logs detectadas`
            );

            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.logs && Array.isArray(data.logs)) {
                // Aplanar logs: crear una entrada por cada log relevante
                data.logs.forEach((log, index) => {
                  if (
                    ['download_attempt', 'download_attempt_blocked', 'download_success'].includes(
                      log.action
                    )
                  ) {
                    this.logs.push({
                      id: `${doc.id}_${index}`,
                      type: log.type || log.eventType || log.action || 'unknown',
                      level: log.level || null,
                      actorUid: log.actorUid || null,
                      actorEmail: log.actorEmail || null,
                      purchaseId: doc.id,
                      userId: data.userId || null,
                      userEmail: data.userEmail || 'Anónimo',
                      productName: data.productName || 'Producto Desconocido',
                      productId: data.productId || null,
                      rawData: {
                        purchaseId: doc.id,
                        userEmail: data.userEmail || null,
                        productName: data.productName || null,
                        ...log,
                      },
                      ...log,
                    });
                  }
                });
              }
            });

            // Ordenar por fecha descendente
            this.logs.sort((a, b) => {
              const timeA = a.timestamp ? a.timestamp.seconds : 0;
              const timeB = b.timestamp ? b.timestamp.seconds : 0;
              return timeB - timeA;
            });

            if (this.logs.length === 0) {
              await this.appendRecentPurchasesFromFallback(this.logs);
            }
            this.applyFilter();
          },
          error => {
            console.error(
              '[AdminAuditRenderer] ❌ Error en ambos listeners. No hay datos disponibles.',
              error
            );
            this.loadMockData();
          }
        );
    }

    subscribeToOrdersFallback() {
      if (!window.firebase) return;
      if (this.fallbackUnsubscribe) return;

      const db = firebase.firestore();
      this.fallbackUnsubscribe = db
        .collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .onSnapshot(
          async snapshot => {
            const userIds = new Set();
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const status = String(data.status || 'completed')
                .toLowerCase()
                .trim();
              if (!this.isSuccessfulPurchaseStatus(status)) return;
              const uid = String(data.userId || '').trim();
              if (uid) userIds.add(uid);
            });

            const missingUids = Array.from(userIds).filter(uid => !this.userProfileCache.has(uid));
            if (missingUids.length > 0) {
              await Promise.all(
                missingUids.map(async uid => {
                  try {
                    const userDoc = await db.collection('users').doc(uid).get();
                    this.userProfileCache.set(uid, userDoc.exists ? userDoc.data() || {} : {});
                  } catch (_e) {
                    this.userProfileCache.set(uid, {});
                  }
                })
              );
            }

            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const status = String(data.status || 'completed')
                .toLowerCase()
                .trim();
              if (!this.isSuccessfulPurchaseStatus(status)) return;

              const userId = String(data.userId || '').trim();
              const userProfile = userId ? this.userProfileCache.get(userId) || {} : {};
              const currentUser = window.firebase?.auth?.().currentUser || null;
              const userEmail =
                data.userEmail ||
                data.email ||
                userProfile.email ||
                (currentUser && currentUser.uid === userId ? currentUser.email : '') ||
                userProfile.displayName ||
                'Usuario desconocido';
              const ip =
                data.ip ||
                data.clientIp ||
                data.client_ip ||
                data.ipAddress ||
                data.lastIP ||
                userProfile.lastIP ||
                userProfile.lastIp ||
                userProfile.ip ||
                'N/A';
              const countryCode = String(
                data.countryCode ||
                  data.country_code ||
                  data.geo?.countryCode ||
                  userProfile.countryCode ||
                  userProfile.geo?.countryCode ||
                  ''
              ).trim();
              const location =
                data.country ||
                data.countryName ||
                data.geo?.country ||
                data.geo?.location ||
                data.location ||
                userProfile.country ||
                userProfile.countryName ||
                userProfile.geo?.country ||
                (ip && ip !== 'N/A' ? 'Sin país (solo IP)' : 'Desconocido');
              const isp =
                data.isp ||
                data.provider ||
                data.source ||
                userProfile.isp ||
                userProfile.network ||
                'N/A';

              this.logs.push({
                id: doc.id,
                type: data.type || 'purchase',
                purchaseId: doc.id,
                userId: userId || null,
                userEmail,
                productName: data.productName || data.productTitle || data.productId || 'Producto',
                productId: data.productId || null,
                timestamp:
                  data.createdAt ||
                  data.timestamp ||
                  data.purchasedAt ||
                  data.completedAt ||
                  data.updatedAt ||
                  null,
                ip,
                ipSource:
                  data.ip || data.clientIp || data.client_ip || data.ipAddress
                    ? 'order'
                    : userProfile.lastIP || userProfile.lastIp || userProfile.ip
                      ? 'user-profile'
                      : currentUser && currentUser.uid === userId
                        ? 'session'
                        : 'unknown',
                geo: {
                  location,
                  flag: this.countryCodeToFlag(countryCode),
                  isp,
                },
                action: 'purchase',
                riskLevel: 'low',
                rawData: data,
              });
            });

            if (this.logs.length === 0) {
              await this.appendRecentPurchasesFromFallback(this.logs);
              if (this.logs.length === 0) {
                this.subscribeToUsersPurchasesFallback();
                return;
              }
            }
            await this.enrichCurrentUserMissingIp(this.logs);
            await this.enrichMissingCountries(this.logs);
            this.applyFilter();
          },
          error => {
            console.warn('[AdminAuditRenderer] Fallback orders no disponible:', error);
            this.subscribeToUsersPurchasesFallback();
          }
        );
    }

    subscribeToCurrentUserPurchasesFallback() {
      if (!window.firebase) return;
      const currentUser = window.firebase.auth?.().currentUser || null;
      const uid = String(currentUser?.uid || '').trim();
      if (!uid) {
        this.subscribeToPurchasesLogs();
        return;
      }

      const db = firebase.firestore();
      if (this.fallbackUnsubscribe) {
        try {
          this.fallbackUnsubscribe();
        } catch (_e) {}
        this.fallbackUnsubscribe = null;
      }

      this.fallbackUnsubscribe = db
        .collection('users')
        .doc(uid)
        .collection('purchases')
        .limit(200)
        .onSnapshot(
          async snapshot => {
            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const status = String(data.status || 'completed')
                .toLowerCase()
                .trim();
              if (!this.isSuccessfulPurchaseStatus(status)) return;

              this.logs.push(this.mapPurchaseToAuditLog(doc.id, data, uid));
            });

            this.logs.sort((a, b) => this.getLogTimestampMs(b) - this.getLogTimestampMs(a));
            if (this.logs.length === 0) {
              await this.appendRecentPurchasesFromFallback(this.logs);
            }
            await this.enrichCurrentUserMissingIp(this.logs);
            await this.enrichMissingCountries(this.logs);
            this.applyFilter();
          },
          error => {
            console.warn(
              '[AdminAuditRenderer] Fallback users/{uid}/purchases no disponible:',
              error
            );
            this.subscribeToPurchasesLogs();
          }
        );
    }

    subscribeToUsersPurchasesFallback() {
      if (!window.firebase) return;
      const db = firebase.firestore();
      if (typeof db.collectionGroup !== 'function') {
        this.subscribeToCurrentUserPurchasesFallback();
        return;
      }

      if (this.fallbackUnsubscribe) {
        try {
          this.fallbackUnsubscribe();
        } catch (_e) {}
        this.fallbackUnsubscribe = null;
      }

      this.fallbackUnsubscribe = db
        .collectionGroup('purchases')
        .limit(400)
        .onSnapshot(
          async snapshot => {
            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const status = String(data.status || 'completed')
                .toLowerCase()
                .trim();
              if (!this.isSuccessfulPurchaseStatus(status)) return;

              const pathParts = String(doc.ref.path || '').split('/');
              const uid = pathParts.length >= 4 ? pathParts[1] : '';

              this.logs.push(this.mapPurchaseToAuditLog(doc.id, data, uid));
            });

            this.logs.sort((a, b) => this.getLogTimestampMs(b) - this.getLogTimestampMs(a));
            if (this.logs.length === 0) {
              await this.appendRecentPurchasesFromFallback(this.logs);
            }
            await this.enrichCurrentUserMissingIp(this.logs);
            await this.enrichMissingCountries(this.logs);
            this.applyFilter();
          },
          error => {
            console.warn(
              '[AdminAuditRenderer] Fallback collectionGroup(purchases) no disponible:',
              error
            );
            this.subscribeToCurrentUserPurchasesFallback();
          }
        );
    }

    cleanupListeners() {
      try {
        if (this.unsubscribe) this.unsubscribe();
        if (this.alertsUnsubscribe) this.alertsUnsubscribe();
        if (this.diagnosticsUnsubscribe) this.diagnosticsUnsubscribe();
        if (this.fallbackUnsubscribe) this.fallbackUnsubscribe();
      } catch (_e) {}
      this.unsubscribe = null;
      this.alertsUnsubscribe = null;
      this.diagnosticsUnsubscribe = null;
      this.fallbackUnsubscribe = null;
      this.resetUiBindings();
    }

    isPublicIPv4(ip) {
      const value = String(ip || '').trim();
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
      const parts = value.split('.').map(n => Number(n));
      if (parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
      if (parts[0] === 10) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 0) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      return true;
    }

    countryCodeToFlag(code) {
      const cc = String(code || '')
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return null;
      return String.fromCodePoint(...[...cc].map(char => 127397 + char.charCodeAt(0)));
    }

    async fetchJsonWithTimeout(url, timeoutMs = 2800) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        return await response.json();
      } catch (_e) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    async resolveCountryByIp(ip) {
      const key = String(ip || '').trim();
      if (!key || !this.isPublicIPv4(key)) return null;
      if (this.ipCountryCache.has(key)) return this.ipCountryCache.get(key);
      // Privacy-first: do not send user IPs to third-party geolocation providers.
      this.ipCountryCache.set(key, null);
      return null;
    }

    async enrichMissingCountries(logs) {
      if (!Array.isArray(logs) || logs.length === 0) return;
      const candidates = logs.filter(log => {
        const ip = String(log?.ip || '').trim();
        const location = String(log?.geo?.location || '')
          .trim()
          .toLowerCase();
        const missingLocation =
          !location ||
          location === 'desconocido' ||
          location === 'sin país (solo ip)' ||
          location === 'n/a';
        return missingLocation && this.isPublicIPv4(ip);
      });
      if (candidates.length === 0) return;

      const uniqueIps = Array.from(new Set(candidates.map(log => String(log.ip || '').trim())));

      for (const ip of uniqueIps) {
        const geo = await this.resolveCountryByIp(ip);
        if (!geo?.country) continue;
        const flag = this.countryCodeToFlag(geo.countryCode);
        logs.forEach(log => {
          if (String(log?.ip || '').trim() !== ip) return;
          log.geo = log.geo || {};
          log.geo.location = geo.country;
          if (flag) log.geo.flag = flag;
        });
      }
    }

    /**
     * Carga datos de prueba si falla la conexión real
     */
    loadMockData() {
      console.warn(
        '[AdminAuditRenderer] ⚠️ No hay datos reales disponibles. Verifica que exista la colección "security_logs" u "orders" en Firestore.'
      );

      this.logs = [];
      this.renderLogs(); // Mostrar tabla vacía con mensaje
    }

    /**
     * Renderiza la tabla de logs
     */
    renderLogs() {
      const tbody = document.getElementById(this.tableBodyId);
      if (!tbody) return;

      if (this.filteredLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="audit-empty">No hay registros</td></tr>';
        // Mantener botones y filtros activos también en estado vacío.
        this.bindEvents();
        return;
      }

      tbody.innerHTML = this.filteredLogs.map(log => this.createRowHTML(log)).join('');

      // Re-bind eventos de botones
      this.bindEvents();
    }

    /**
     * Crea el HTML de una fila
     */
    createRowHTML(log) {
      const isAdminAction = String(log?.type || '').toLowerCase() === 'admin_action';
      const risk = this.calculateRisk(log);
      const location = isAdminAction
        ? log.actorUid || log.userId || 'N/A'
        : log.geo
          ? log.geo.location
          : 'Desconocido';
      let flag = '🌍';
      if (!isAdminAction && log.geo && log.geo.flag) {
        const flagValue = String(log.geo.flag);
        if (/^https?:\/\//i.test(flagValue)) {
          flag = `<img src="${flagValue}" class="audit-flag" alt="flag">`;
        } else {
          flag = `<span class="audit-flag-code">${flagValue}</span>`;
        }
      }
      const isp = isAdminAction
        ? `UI:${String(log?.source || log?.rawData?.source || 'admin_ui')}`
        : log.geo
          ? log.geo.isp
          : 'N/A';
      const fullDate = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : '';
      const ipSourceLabelMap = {
        order: 'Pago',
        purchase: 'Compra',
        session: 'Sesión actual',
        firestore: 'Log',
        'user-profile': 'Perfil (última IP)',
        unknown: 'Sin origen',
      };
      const ipSourceRaw = String(log.ipSource || 'unknown').toLowerCase();
      const ipSourceLabel = ipSourceLabelMap[ipSourceRaw] || ipSourceRaw.toUpperCase();
      const ipSourceClass =
        log.ipSource && log.ipSource !== 'unknown' ? 'ip-source-ok' : 'ip-source-warn';
      const riskIcon = risk.level === 'high' ? '⛔' : risk.level === 'medium' ? '⚠️' : '✅';
      const vpnProviders = [
        'DigitalOcean',
        'AWS',
        'Amazon',
        'Google Cloud',
        'GCP',
        'Azure',
        'Microsoft',
        'OVH',
        'Hetzner',
        'Linode',
        'Vultr',
        'M247',
        'Datacamp',
        'Oracle',
        'Alibaba',
        'Cloudflare',
      ];
      const vpnBadge =
        !isAdminAction && log.geo && log.geo.isp && vpnProviders.some(p => log.geo.isp.includes(p))
          ? '<span class="vpn-badge">VPN/Hosting</span>'
          : '';

      // Estilo para intentos bloqueados
      const isBlocked = log.action === 'download_attempt_blocked';
      const userLabel =
        log.userEmail || log.actorEmail || (log.actorUid ? `UID:${log.actorUid}` : 'Anónimo');
      const productLabel = isAdminAction
        ? `Admin action: ${log.action || 'unknown'}`
        : log.productName;
      return `
                <tr class="audit-row${isBlocked ? ' audit-row-blocked' : ''}">
                    <td>
                        <div class="audit-user">${userLabel}</div>
                        <small class="audit-date">${fullDate}</small>
                    </td>
                    <td class="audit-product">${productLabel}</td>
                    <td>
                        <div class="audit-location">
                            ${flag}
                            <span>${location}</span>
                        </div>
                        <span class="audit-ip">${log.ip || 'N/A'}</span>
                        <span class="ip-source ${ipSourceClass}" title="Fuente de IP: ${ipSourceLabel}">IP: ${ipSourceLabel}</span>
                    </td>
                    <td><span class="isp-tag">${isp}</span>${vpnBadge}</td>
                    <td><span class="risk-badge risk-${risk.level}">${riskIcon} ${risk.label}</span></td>
                    <td>
                        <div class="audit-actions">
                            ${
                              isAdminAction
                                ? ''
                                : `<button class="btn-ban" data-action="adminRevokeAccess" data-id="${log.purchaseId}" data-userid="${log.userId || ''}" data-productid="${log.productId || ''}" title="Revocar acceso">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                REVOCAR
                            </button>`
                            }
                            <button class="btn-delete-log" data-action="adminDeleteLog" data-id="${log.id}" title="Eliminar log">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                            <button class="btn-details-log" data-action="adminViewLogDetails" data-id="${log.id}" title="Ver datos completos">
                                Detalles
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    }

    /**
     * Calcula el nivel de riesgo
     */
    calculateRisk(log) {
      const explicit = String(log?.level || '').toLowerCase();
      if (['high', 'medium', 'low'].includes(explicit)) {
        return {
          level: explicit,
          label: explicit === 'high' ? 'ALTO' : explicit === 'medium' ? 'MEDIO' : 'BAJO',
        };
      }
      if (log.action === 'download_attempt_blocked')
        return {
          level: 'high',
          label: 'CRÍTICO',
        };

      // Detección básica de VPN por ISP (lista ejemplo)
      const vpnISPs = ['DigitalOcean', 'AWS', 'Google Cloud', 'M247', 'Datacamp'];
      if (log.geo && log.geo.isp && vpnISPs.some(provider => log.geo.isp.includes(provider))) {
        return {
          level: 'medium',
          label: 'VPN DETECTADA',
        };
      }

      return {
        level: 'low',
        label: 'NORMAL',
      };
    }

    /**
     * Vincula eventos a botones generados
     */
    bindEvents() {
      // Acciones de fila: usar EventDelegation cuando esté disponible.
      if (window.EventDelegation && !this.handlersRegistered) {
        window.EventDelegation.registerHandler('adminRevokeAccess', target => {
          const id = target.dataset.id;
          const userId = target.dataset.userid || null;
          const productId = target.dataset.productid || null;
          this.revokeAccess(id, userId, productId);
        });

        window.EventDelegation.registerHandler('adminDeleteLog', target => {
          const id = target.dataset.id;
          this.deleteLog(id);
        });

        window.EventDelegation.registerHandler('adminViewLogDetails', target => {
          const id = target.dataset.id;
          this.showLogDetails(id);
        });

        this.handlersRegistered = true;
      }

      this.bindAdvancedFilterInputs();
      this.bindLocalActionsFallback();
    }

    bindLocalActionsFallback() {
      const container = document.getElementById(this.containerId);
      if (!container) return;
      if (this.localActionsBound && this.localActionsContainer === container) {
        return;
      }
      if (this.localActionsBound && this.localActionsContainer && this.localActionsHandler) {
        try {
          this.localActionsContainer.removeEventListener('click', this.localActionsHandler);
        } catch (_e) {}
      }

      this.localActionsHandler = event => {
        const filterBtn =
          event.target && typeof event.target.closest === 'function'
            ? event.target.closest('.audit-filter-btn')
            : null;
        if (filterBtn && container.contains(filterBtn)) {
          const filter = String(filterBtn.dataset.filter || '').trim();
          if (filter) {
            this.timeFilter = filter;
            container
              .querySelectorAll('.audit-filter-btn')
              .forEach(btn => btn.classList.remove('active'));
            filterBtn.classList.add('active');
            this.applyFilter();
          }
          return;
        }

        const target =
          event.target && typeof event.target.closest === 'function'
            ? event.target.closest('[data-action]')
            : null;
        if (!target || !container.contains(target)) return;

        const action = String(target.dataset.action || '').trim();
        if (!action) return;

        // If central delegation is available for this action, avoid duplicate execution.
        if (window.EventDelegation?.handlers?.has(action)) return;

        switch (action) {
          case 'adminClearAllLogs':
            event.preventDefault();
            this.clearAllLogs();
            break;
          case 'adminDeleteLog':
            event.preventDefault();
            this.deleteLog(target.dataset.id);
            break;
          case 'adminRevokeAccess':
            event.preventDefault();
            this.revokeAccess(
              target.dataset.id,
              target.dataset.userid || null,
              target.dataset.productid || null
            );
            break;
          case 'adminExportIntrusionLogsJson':
            event.preventDefault();
            this.exportLogs('json');
            break;
          case 'adminExportIntrusionLogsCsv':
            event.preventDefault();
            this.exportLogs('csv');
            break;
          case 'adminClearIntrusionFilters':
            event.preventDefault();
            this.clearAdvancedFilters();
            break;
          case 'adminViewLogDetails':
            event.preventDefault();
            this.showLogDetails(target.dataset.id);
            break;
          default:
            break;
        }
      };

      container.addEventListener('click', this.localActionsHandler);
      this.localActionsBound = true;
      this.localActionsContainer = container;
    }

    bindAdvancedFilterInputs() {
      const inputIds = [
        'auditFilterIp',
        'auditFilterUid',
        'auditFilterEmail',
        'auditFilterType',
        'auditFilterAction',
        'auditFilterRisk',
        'auditFilterFrom',
        'auditFilterTo',
      ];

      inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.bound === 'true') return;
        el.dataset.bound = 'true';
        const eventName = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
        el.addEventListener(eventName, () => {
          this.syncAdvancedFiltersFromUi();
          this.applyFilter();
        });
      });
    }

    syncAdvancedFiltersFromUi() {
      this.queryFilters.ip = String(document.getElementById('auditFilterIp')?.value || '')
        .trim()
        .toLowerCase();
      this.queryFilters.uid = String(document.getElementById('auditFilterUid')?.value || '')
        .trim()
        .toLowerCase();
      this.queryFilters.email = String(document.getElementById('auditFilterEmail')?.value || '')
        .trim()
        .toLowerCase();
      this.queryFilters.type = String(document.getElementById('auditFilterType')?.value || 'all')
        .trim()
        .toLowerCase();
      this.queryFilters.action = String(document.getElementById('auditFilterAction')?.value || '')
        .trim()
        .toLowerCase();
      this.queryFilters.risk = String(document.getElementById('auditFilterRisk')?.value || 'all')
        .trim()
        .toLowerCase();
      this.queryFilters.from = String(
        document.getElementById('auditFilterFrom')?.value || ''
      ).trim();
      this.queryFilters.to = String(document.getElementById('auditFilterTo')?.value || '').trim();
    }

    clearAdvancedFilters() {
      const ids = [
        'auditFilterIp',
        'auditFilterUid',
        'auditFilterEmail',
        'auditFilterType',
        'auditFilterAction',
        'auditFilterRisk',
        'auditFilterFrom',
        'auditFilterTo',
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'auditFilterRisk' || id === 'auditFilterType') {
          el.value = 'all';
        } else {
          el.value = '';
        }
      });
      this.syncAdvancedFiltersFromUi();
      this.applyFilter();
    }

    getLogTimestampMs(log) {
      if (log?.timestamp?.seconds) return log.timestamp.seconds * 1000;
      if (log?.timestamp?.toDate) return log.timestamp.toDate().getTime();
      const parsed = Date.parse(log?.timestamp || '');
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    getDerivedRiskLevel(log) {
      if (
        log?.riskLevel &&
        ['low', 'medium', 'high'].includes(String(log.riskLevel).toLowerCase())
      ) {
        return String(log.riskLevel).toLowerCase();
      }
      return this.calculateRisk(log).level;
    }

    matchesAdvancedFilters(log, timestampMs) {
      const ip = String(log?.ip || '').toLowerCase();
      const uid = String(log?.userId || '').toLowerCase();
      const email = String(log?.userEmail || '').toLowerCase();
      const type = String(log?.type || '').toLowerCase();
      const action = String(log?.action || '').toLowerCase();
      const actorUid = String(log?.actorUid || '').toLowerCase();
      const actorEmail = String(log?.actorEmail || '').toLowerCase();
      const risk = this.getDerivedRiskLevel(log);

      if (this.queryFilters.ip && !ip.includes(this.queryFilters.ip)) return false;
      if (this.queryFilters.uid && !uid.includes(this.queryFilters.uid)) return false;
      if (this.queryFilters.email && !email.includes(this.queryFilters.email)) return false;
      if (this.queryFilters.type !== 'all' && type !== this.queryFilters.type) return false;
      if (this.queryFilters.action) {
        const haystack = `${action} ${actorUid} ${actorEmail}`.trim();
        if (!haystack.includes(this.queryFilters.action)) return false;
      }
      if (this.queryFilters.risk !== 'all' && risk !== this.queryFilters.risk) return false;

      if (this.queryFilters.from) {
        const fromMs = new Date(`${this.queryFilters.from}T00:00:00`).getTime();
        if (timestampMs < fromMs) return false;
      }
      if (this.queryFilters.to) {
        const toMs = new Date(`${this.queryFilters.to}T23:59:59`).getTime();
        if (timestampMs > toMs) return false;
      }

      return true;
    }

    /**
     * Aplicar filtro temporal a logs
     */
    applyFilter() {
      return this.runSafely(
        'Error aplicando filtros',
        () => {
          const now = Date.now();
          const cutoff =
            this.timeFilter === '1h'
              ? now - 60 * 60 * 1000
              : this.timeFilter === '24h'
                ? now - 24 * 60 * 60 * 1000
                : this.timeFilter === '7d'
                  ? now - 7 * 24 * 60 * 60 * 1000
                  : null;

          const sourceLogs = Array.isArray(this.logs) ? this.logs : [];
          this.filteredLogs = sourceLogs.filter(log => {
            const ts = this.getLogTimestampMs(log);
            if (cutoff && ts < cutoff) return false;
            return this.matchesAdvancedFilters(log, ts);
          });

          this.renderLogs();
        },
        null
      );
    }

    /**
     * Revoca el acceso manualmente
     */
    async revokeAccess(purchaseId, userId, productId) {
      if (
        !confirm(
          `¿Estás seguro de que deseas REVOCAR el acceso a la compra ${purchaseId}? Esta acción es irreversible.`
        )
      )
        return;

      try {
        if (!userId) {
          throw new Error('No se pudo determinar el userId para revocar acceso');
        }

        if (window.firebase && firebase.functions) {
          const fn = firebase.functions().httpsCallable('revokePurchaseAccess');
          await fn({
            purchaseId: purchaseId,
            userId: userId,
            productId: productId,
          });
        } else {
          // Fallback legacy (no recomendado)
          await firebase
            .firestore()
            .collection('purchases')
            .doc(purchaseId)
            .update({
              'downloadAccess.status': 'revoked',
              'downloadAccess.revocationReason': 'Manual Revocation by Admin',
              adminNote: `Revoked manually at ${new Date().toISOString()}`,
            });
        }

        if (window.NotificationSystem) {
          window.NotificationSystem.success(`Acceso revocado para ${purchaseId}`);
        }
      } catch (error) {
        console.error('Error revoking access:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error('Error al revocar acceso');
        }
      }
    }

    /**
     * Elimina un log individual
     */
    async deleteLog(logId) {
      if (!logId) {
        console.error('[AdminAuditRenderer] ❌ ID de log no válido');
        return;
      }

      if (!confirm('¿Estás seguro de que deseas eliminar este log? Esta acción es irreversible.'))
        return;

      try {
        debugLog(`[AdminAuditRenderer] 🗑️ Eliminando log: ${logId}`);

        await firebase.firestore().collection('security_logs').doc(logId).delete();

        if (window.NotificationSystem) {
          window.NotificationSystem.success('Log eliminado correctamente');
        }

        debugLog(`[AdminAuditRenderer] ✅ Log eliminado: ${logId}`);
      } catch (error) {
        console.error('[AdminAuditRenderer] ❌ Error eliminando log:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(`Error al eliminar log: ${error.message}`);
        }
      }
    }

    /**
     * Limpia todos los logs de seguridad
     */
    async clearAllLogs() {
      if (this.logs.length === 0) {
        if (window.NotificationSystem) {
          window.NotificationSystem.info('No hay logs para eliminar');
        }
        return;
      }

      const confirmMessage = `¿Estás seguro de que deseas ELIMINAR TODOS los logs (${this.logs.length} registros)?\n\n⚠️ ESTA ACCIÓN ES IRREVERSIBLE Y ELIMINARÁ TODOS LOS DATOS DE SEGURIDAD.`;

      if (!confirm(confirmMessage)) return;

      // Doble confirmación para acción crítica
      if (!confirm('⚠️ ÚLTIMA CONFIRMACIÓN: ¿Realmente deseas eliminar TODOS los logs?')) return;

      try {
        debugLog(`[AdminAuditRenderer] 🗑️ Eliminando ${this.logs.length} logs...`);

        const db = firebase.firestore();
        const batch = db.batch();
        let deleteCount = 0;

        // Agregar todos los logs al batch
        this.logs.forEach(log => {
          if (log.id) {
            const docRef = db.collection('security_logs').doc(log.id);
            batch.delete(docRef);
            deleteCount++;
          }
        });

        // Ejecutar batch delete
        await batch.commit();

        if (window.NotificationSystem) {
          window.NotificationSystem.success(`${deleteCount} logs eliminados correctamente`);
        }

        debugLog(`[AdminAuditRenderer] ✅ ${deleteCount} logs eliminados exitosamente`);
      } catch (error) {
        console.error('[AdminAuditRenderer] ❌ Error eliminando logs:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(`Error al eliminar logs: ${error.message}`);
        }
      }
    }

    escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    getLogById(logId) {
      if (!logId) return null;
      return this.logs.find(entry => String(entry.id) === String(logId)) || null;
    }

    normalizeLogForExport(log) {
      const timestamp = log?.timestamp?.toDate
        ? log.timestamp.toDate().toISOString()
        : log?.timestamp?.seconds
          ? new Date(log.timestamp.seconds * 1000).toISOString()
          : log?.timestamp || null;
      return {
        id: log?.id || null,
        purchaseId: log?.purchaseId || null,
        userId: log?.userId || null,
        userEmail: log?.userEmail || null,
        productId: log?.productId || null,
        productName: log?.productName || null,
        type: log?.type || null,
        level: log?.level || null,
        actorUid: log?.actorUid || null,
        actorEmail: log?.actorEmail || null,
        action: log?.action || null,
        ip: log?.ip || null,
        ipSource: log?.ipSource || null,
        location: log?.geo?.location || null,
        flag: log?.geo?.flag || null,
        isp: log?.geo?.isp || null,
        riskLevel: log?.riskLevel || null,
        timestamp,
        rawData: log?.rawData || null,
      };
    }

    downloadFile(content, mimeType, fileName) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    exportLogs(format = 'json') {
      if (!Array.isArray(this.filteredLogs) || this.filteredLogs.length === 0) {
        if (window.NotificationSystem) {
          window.NotificationSystem.info('No hay logs para exportar');
        }
        return;
      }

      const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
      const exportRows = this.filteredLogs.map(entry => this.normalizeLogForExport(entry));

      if (format === 'csv') {
        const headers = [
          'id',
          'purchaseId',
          'userId',
          'userEmail',
          'productId',
          'productName',
          'type',
          'level',
          'actorUid',
          'actorEmail',
          'action',
          'ip',
          'ipSource',
          'location',
          'flag',
          'isp',
          'riskLevel',
          'timestamp',
          'rawData',
        ];
        const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csvBody = exportRows
          .map(row =>
            headers
              .map(key =>
                key === 'rawData'
                  ? escapeCell(JSON.stringify(row.rawData || {}))
                  : escapeCell(row[key])
              )
              .join(',')
          )
          .join('\n');
        this.downloadFile(
          `${headers.join(',')}\n${csvBody}`,
          'text/csv;charset=utf-8',
          `intrusion-logs_${safeDate}.csv`
        );
      } else {
        this.downloadFile(
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              count: exportRows.length,
              logs: exportRows,
            },
            null,
            2
          ),
          'application/json;charset=utf-8',
          `intrusion-logs_${safeDate}.json`
        );
      }

      if (window.NotificationSystem) {
        window.NotificationSystem.success(`Logs de intrusión exportados (${format.toUpperCase()})`);
      }
    }

    showLogDetails(logId) {
      const log = this.getLogById(logId);
      if (!log) {
        if (window.NotificationSystem) {
          window.NotificationSystem.error('No se encontró el log seleccionado');
        }
        return;
      }

      const normalized = this.normalizeLogForExport(log);
      const html = `
        <dialog class="audit-log-modal__overlay" id="auditLogDetailsOverlay" aria-hidden="true">
          <div class="audit-log-modal">
            <div class="audit-log-modal__header">
              <h4>Detalle completo del log</h4>
              <button type="button" class="audit-log-modal__close" data-action="adminCloseLogDetails">Cerrar</button>
            </div>
            <pre class="audit-log-modal__content">${this.escapeHtml(
              JSON.stringify(normalized, null, 2)
            )}</pre>
          </div>
        </dialog>
      `;

      const existing = document.getElementById('auditLogDetailsOverlay');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', html);

      const overlay = document.getElementById('auditLogDetailsOverlay');
      if (!overlay) return;
      overlay.setAttribute('aria-hidden', 'false');
      if (typeof overlay.showModal === 'function' && !overlay.open) {
        overlay.showModal();
      }

      const closeModal = () => {
        overlay.setAttribute('aria-hidden', 'true');
        if (typeof overlay.close === 'function' && overlay.open) {
          overlay.close();
        }
        overlay.remove();
      };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closeModal();
      });
      const closeBtn = overlay.querySelector('[data-action="adminCloseLogDetails"]');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
    }

    resetUiBindings() {
      if (this.localActionsContainer && this.localActionsHandler) {
        try {
          this.localActionsContainer.removeEventListener('click', this.localActionsHandler);
        } catch (_e) {}
      }
      this.localActionsBound = false;
      this.localActionsContainer = null;
      this.localActionsHandler = null;
      this.handlersRegistered = false;
    }
  }

  // Instancia global
  window.AdminAuditRenderer = new AdminAuditRenderer();

  // Auto-inicializar cuando el dashboard se active
  const setupAutoInit = () => {
    const dashboardSection = document.getElementById('dashboardSection');
    if (!dashboardSection) {
      debugLog('[AdminAuditRenderer] Dashboard no encontrado, esperando...');
      return;
    }

    // Observer para detectar cuando se activa el dashboard
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isActive = dashboardSection.classList.contains('active');
          if (isActive && window.AdminAuditRenderer) {
            debugLog('[AdminAuditRenderer] Dashboard activado, inicializando Monitor...');
            if (!window.AdminAuditRenderer.initialized) {
              window.AdminAuditRenderer.init();
            } else {
              window.AdminAuditRenderer.ensureInteractive();
            }
          }
        }
      });
    });

    observer.observe(dashboardSection, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Si el dashboard ya está activo, inicializar inmediatamente
    if (dashboardSection.classList.contains('active')) {
      debugLog('[AdminAuditRenderer] Dashboard ya activo, inicializando Monitor...');
      if (!window.AdminAuditRenderer.initialized) {
        window.AdminAuditRenderer.init();
      } else {
        window.AdminAuditRenderer.ensureInteractive();
      }
    }
  };

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoInit);
  } else {
    setupAutoInit();
  }

  debugLog('✅ AdminAuditRenderer cargado y listo para inicializar');
}

export function initAdminAuditRenderer() {
  if (window.__ADMIN_AUDIT_RENDERER_INITED__) {
    return;
  }

  window.__ADMIN_AUDIT_RENDERER_INITED__ = true;
  setupAdminAuditRenderer();
}

if (typeof window !== 'undefined' && !window.__ADMIN_AUDIT_RENDERER_NO_AUTO__) {
  initAdminAuditRenderer();
}
