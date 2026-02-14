/**
 * Admin Audit Renderer
 * Gestiona la visualización del panel de auditoría de seguridad en tiempo real.
 */

'use strict';

function setupAdminAuditRenderer() {

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
        return !!claims?.admin || claims?.role === 'admin';
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
      this.isLoading = false;
      this.unsubscribe = null; // Firestore listener
      this.alertsUnsubscribe = null; // Alerts listener
      this.initialized = false;
      this.timeFilter = '24h';
      this._logoutCleanupBound = false;
    }

    /**
     * Inicializa el renderer
     */
    async init() {
      if (this.initialized) {
        console.log('[AdminAuditRenderer] ℹ️ Ya inicializado. Saltando.');
        return;
      }

      console.log(
        '[AdminAuditRenderer] 🚀 Iniciando inicialización del monitor de seguridad...'
      );

      // Security Check: Verify Admin UID
      if (!window.firebase || !window.firebase.auth()) {
        console.log('[AdminAuditRenderer] ⏳ Esperando a Firebase Auth...');
        return;
      }

      const user = window.firebase.auth().currentUser;

      if (!user) {
        console.log(
          '[AdminAuditRenderer] ⛔ No hay usuario autenticado. Cancelando.'
        );
        this.initialized = false;
        return;
      }

      if (!this._logoutCleanupBound) {
        this._logoutCleanupBound = true;
        window.addEventListener('auth:logout', () => {
          try {
            if (this.unsubscribe) this.unsubscribe();
            if (this.alertsUnsubscribe) this.alertsUnsubscribe();
          } catch (_e) {}
          this.initialized = false;
        });
      }

      // Verificar si el usuario es administrador (vía AppState o claims)
      const isAdmin = await isAdminUser(user);

      if (!isAdmin) {
        console.log(
          `[AdminAuditRenderer] ⛔ Acceso denegado: Usuario ${user.email} no es administrador.`
        );
        return;
      }

      console.log(
        '[AdminAuditRenderer] ✅ Permisos de administrador verificados.'
      );

      // Verificar que Firebase esté disponible
      if (!window.firebase) {
        console.error(
          '[AdminAuditRenderer] ❌ Firebase no está disponible. Abortando inicialización.'
        );
        return;
      }

      console.log('[AdminAuditRenderer] ✅ Firebase disponible');

      // Inyectar el contenedor si no existe
      this.ensureContainer();

      // Verificar que el contenedor se creó correctamente
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error(
          '[AdminAuditRenderer] ❌ No se pudo crear el contenedor. Abortando.'
        );
        return;
      }

      console.log('[AdminAuditRenderer] ✅ Contenedor verificado en DOM');

      // Iniciar listeners
      this.subscribeToLogs();
      this.subscribeToAlerts();
      this.subscribeToDiagnostics();

      this.initialized = true;
      console.log('[AdminAuditRenderer] ✅ Inicialización completada');
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

      console.log(
        '[AdminAuditRenderer] ✅ Contenedor del dashboard encontrado'
      );

      // Verificar si ya existe
      if (document.getElementById(this.containerId)) {
        console.log('[AdminAuditRenderer] ℹ️ Monitor ya existe en el DOM');
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
                        <button class="btn-clear-all" data-action="adminClearAllLogs" title="Limpiar todos los logs">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Limpiar Todo
                        </button>
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
        console.log(
          '[AdminAuditRenderer] 📍 Insertando Monitor después de dashboardStatsContainer'
        );
        statsContainer.insertAdjacentHTML('afterend', auditHTML);
      } else {
        console.log(
          '[AdminAuditRenderer] 📍 Insertando Monitor al final del dashboardSection'
        );
        dashboardSection.insertAdjacentHTML('beforeend', auditHTML);
      }

      console.log(
        '[AdminAuditRenderer] ✅ HTML del Monitor insertado en el DOM'
      );

      // Inicializar iconos
      if (window.lucide) {
        window.lucide.createIcons();
        console.log('[AdminAuditRenderer] ✅ Iconos Lucide inicializados');
      }
    }

    /**
     * Se suscribe a los cambios en la colección de logs/compras
     */
    subscribeToLogs() {
      if (!window.firebase) return;

      const db = firebase.firestore();

      console.log(
        '[AdminAuditRenderer] 🔥 Configurando listener en tiempo real para logs de seguridad...'
      );

      // OPCIÓN 1: Intentar colección dedicada 'security_logs' (recomendado para producción)
      this.unsubscribe = db
        .collection('security_logs')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(
          snapshot => {
            console.log(
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
              const location =
                geoData.location || data.country || 'Desconocido';
              const isp =
                geoData.isp || data.isp || data.payment_method || 'N/A';
              let ipSource =
                data.ipSource || data.ip_source || data.ipOrigin || 'unknown';

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
                purchaseId: data.purchaseId || doc.id,
                userId: data.userId || null,
                userEmail: data.userEmail || data.email || 'Anónimo',
                productName:
                  data.productName ||
                  data.productTitle ||
                  data.product ||
                  'Producto Desconocido',
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
              });
            });

            this.applyFilter();
          },
          error => {
            // Si es error de permisos, no intentar fallback
            if (error.code === 'permission-denied') {
              console.warn(
                '[AdminAuditRenderer] ⛔ Acceso denegado a security_logs. Usuario no es administrador.'
              );
              this.renderEmptyState(
                'No tienes permisos para ver los logs de seguridad'
              );
              return;
            }

            console.warn(
              '[AdminAuditRenderer] Error en listener de security_logs, intentando con purchases...',
              error
            );

            // OPCIÓN 2: Fallback a 'purchases' con logs embebidos
            this.subscribeToPurchasesLogs();
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
          snapshot => {
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
              console.warn(
                '[AdminAuditRenderer] ⛔ Sin permisos para leer alerts.'
              );
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

      db.collection('security_logs_diagnostics')
        .where('timestamp', '>=', since)
        .limit(200)
        .onSnapshot(
          snapshot => {
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
              console.warn(
                '[AdminAuditRenderer] ⛔ Sin permisos para leer diagnósticos.'
              );
              return;
            }
            console.warn(
              '[AdminAuditRenderer] Error leyendo diagnósticos:',
              error
            );
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
        console.log('[AdminAuditRenderer] ✅ Alertas marcadas como leídas');
      } catch (error) {
        console.warn('[AdminAuditRenderer] Error marcando alertas:', error);
      }
    }

    /**
     * Fallback: Suscribirse a purchases con logs de seguridad
     */
    subscribeToPurchasesLogs() {
      const db = firebase.firestore();

      this.unsubscribe = db
        .collection('purchases')
        .where('hasSecurityLogs', '==', true)
        .limit(20)
        .onSnapshot(
          snapshot => {
            console.log(
              `[AdminAuditRenderer] 📊 [TIEMPO REAL] ${snapshot.size} compras con logs detectadas`
            );

            this.logs = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.logs && Array.isArray(data.logs)) {
                // Aplanar logs: crear una entrada por cada log relevante
                data.logs.forEach(log => {
                  if (
                    [
                      'download_attempt',
                      'download_attempt_blocked',
                      'download_success',
                    ].includes(log.action)
                  ) {
                    this.logs.push({
                      purchaseId: doc.id,
                      userEmail: data.userEmail || 'Anónimo',
                      productName: data.productName || 'Producto Desconocido',
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

    /**
     * Carga datos de prueba si falla la conexión real
     */
    loadMockData() {
      console.warn(
        '[AdminAuditRenderer] ⚠️ No hay datos reales disponibles. Verifica que exista la colección "security_logs" o "purchases" con logs de seguridad en Firestore.'
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
        tbody.innerHTML =
          '<tr><td colspan="6" class="audit-empty">No hay actividad reciente</td></tr>';
        return;
      }

      tbody.innerHTML = this.filteredLogs
        .map(log => this.createRowHTML(log))
        .join('');

      // Re-bind eventos de botones
      this.bindEvents();
    }

    /**
     * Crea el HTML de una fila
     */
    createRowHTML(log) {
      const risk = this.calculateRisk(log);
      const location = log.geo ? log.geo.location : 'Desconocido';
      let flag = '🌍';
      if (log.geo && log.geo.flag) {
        const flagValue = String(log.geo.flag);
        if (/^https?:\/\//i.test(flagValue)) {
          flag = `<img src="${flagValue}" class="audit-flag" alt="flag">`;
        } else {
          flag = `<span class="audit-flag-code">${flagValue}</span>`;
        }
      }
      const isp = log.geo ? log.geo.isp : 'N/A';
      const fullDate = log.timestamp
        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
        : '';
      const ipSourceLabel =
        log.ipSource && log.ipSource !== 'unknown'
          ? log.ipSource.toUpperCase()
          : 'UNKNOWN';
      const ipSourceClass =
        log.ipSource && log.ipSource !== 'unknown'
          ? 'ip-source-ok'
          : 'ip-source-warn';
      const riskIcon =
        risk.level === 'high'
          ? '⛔'
          : risk.level === 'medium'
            ? '⚠️'
            : '✅';
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
        log.geo &&
        log.geo.isp &&
        vpnProviders.some(p => log.geo.isp.includes(p))
          ? '<span class="vpn-badge">VPN/Hosting</span>'
          : '';

      // Estilo para intentos bloqueados
      const isBlocked = log.action === 'download_attempt_blocked';
      return `
                <tr class="audit-row${isBlocked ? ' audit-row-blocked' : ''}">
                    <td>
                        <div class="audit-user">${log.userEmail}</div>
                        <small class="audit-date">${fullDate}</small>
                    </td>
                    <td class="audit-product">${log.productName}</td>
                    <td>
                        <div class="audit-location">
                            ${flag}
                            <span>${location}</span>
                        </div>
                        <span class="audit-ip">${log.ip}</span>
                        <span class="ip-source ${ipSourceClass}" title="Fuente de IP: ${ipSourceLabel}">IP: ${ipSourceLabel}</span>
                    </td>
                    <td><span class="isp-tag">${isp}</span>${vpnBadge}</td>
                    <td><span class="risk-badge risk-${risk.level}">${riskIcon} ${risk.label}</span></td>
                    <td>
                        <div class="audit-actions">
                            <button class="btn-ban" data-action="adminRevokeAccess" data-id="${log.purchaseId}" data-userid="${log.userId || ''}" data-productid="${log.productId || ''}" title="Revocar acceso">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                REVOCAR
                            </button>
                            <button class="btn-delete-log" data-action="adminDeleteLog" data-id="${log.id}" title="Eliminar log">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
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
      if (log.action === 'download_attempt_blocked')
        return {
          level: 'high',
          label: 'CRÍTICO',
        };

      // Detección básica de VPN por ISP (lista ejemplo)
      const vpnISPs = [
        'DigitalOcean',
        'AWS',
        'Google Cloud',
        'M247',
        'Datacamp',
      ];
      if (
        log.geo &&
        log.geo.isp &&
        vpnISPs.some(provider => log.geo.isp.includes(provider))
      ) {
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
      // Usar EventDelegation si está disponible, si no, manual
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

        window.EventDelegation.registerHandler('adminClearAllLogs', () => {
          this.clearAllLogs();
        });

        this.handlersRegistered = true;
      }

      // Filtros de tiempo
      const filterButtons = document.querySelectorAll('.audit-filter-btn');
      filterButtons.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
          const filter = btn.dataset.filter;
          this.timeFilter = filter;
          filterButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.applyFilter();
        });
      });
    }

    /**
     * Aplicar filtro temporal a logs
     */
    applyFilter() {
      const now = Date.now();
      const cutoff =
        this.timeFilter === '1h'
          ? now - 60 * 60 * 1000
          : this.timeFilter === '24h'
            ? now - 24 * 60 * 60 * 1000
            : this.timeFilter === '7d'
              ? now - 7 * 24 * 60 * 60 * 1000
              : null;

      this.filteredLogs = this.logs.filter(log => {
        if (!cutoff) return true;
        const ts = log.timestamp?.seconds
          ? log.timestamp.seconds * 1000
          : log.timestamp?.toDate
            ? log.timestamp.toDate().getTime()
            : 0;
        return ts >= cutoff;
      });

      this.renderLogs();
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
          window.NotificationSystem.success(
            `Acceso revocado para ${purchaseId}`
          );
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

      if (
        !confirm(
          '¿Estás seguro de que deseas eliminar este log? Esta acción es irreversible.'
        )
      )
        return;

      try {
        console.log(`[AdminAuditRenderer] 🗑️ Eliminando log: ${logId}`);

        await firebase
          .firestore()
          .collection('security_logs')
          .doc(logId)
          .delete();

        if (window.NotificationSystem) {
          window.NotificationSystem.success('Log eliminado correctamente');
        }

        console.log(`[AdminAuditRenderer] ✅ Log eliminado: ${logId}`);
      } catch (error) {
        console.error('[AdminAuditRenderer] ❌ Error eliminando log:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            `Error al eliminar log: ${error.message}`
          );
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
      if (
        !confirm(
          '⚠️ ÚLTIMA CONFIRMACIÓN: ¿Realmente deseas eliminar TODOS los logs?'
        )
      )
        return;

      try {
        console.log(
          `[AdminAuditRenderer] 🗑️ Eliminando ${this.logs.length} logs...`
        );

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
          window.NotificationSystem.success(
            `${deleteCount} logs eliminados correctamente`
          );
        }

        console.log(
          `[AdminAuditRenderer] ✅ ${deleteCount} logs eliminados exitosamente`
        );
      } catch (error) {
        console.error('[AdminAuditRenderer] ❌ Error eliminando logs:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            `Error al eliminar logs: ${error.message}`
          );
        }
      }
    }

    /**
     * Renderiza un estado vacío con mensaje personalizado
     * @param {string} message - Mensaje a mostrar
     */
    renderEmptyState(message = 'No hay logs de seguridad disponibles') {
      const container = document.getElementById('auditLogsContainer');
      if (!container) return;

      container.innerHTML = `
                <div class="audit-empty-state">
                    <div class="empty-icon">🔒</div>
                    <p class="empty-message">${message}</p>
                </div>
            `;
    }
  }

  // Instancia global
  window.AdminAuditRenderer = new AdminAuditRenderer();

  // Auto-inicializar cuando el dashboard se active
  const setupAutoInit = () => {
    const dashboardSection = document.getElementById('dashboardSection');
    if (!dashboardSection) {
      console.log('[AdminAuditRenderer] Dashboard no encontrado, esperando...');
      return;
    }

    // Observer para detectar cuando se activa el dashboard
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const isActive = dashboardSection.classList.contains('active');
          if (
            isActive &&
            window.AdminAuditRenderer &&
            !document.getElementById('adminAuditSection')
          ) {
            console.log(
              '[AdminAuditRenderer] Dashboard activado, inicializando Monitor...'
            );
            window.AdminAuditRenderer.init();
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
      console.log(
        '[AdminAuditRenderer] Dashboard ya activo, inicializando Monitor...'
      );
      window.AdminAuditRenderer.init();
    }
  };

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoInit);
  } else {
    setupAutoInit();
  }

  console.log('✅ AdminAuditRenderer cargado y listo para inicializar');
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
