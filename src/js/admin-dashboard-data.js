/**
 * Admin Dashboard - Data + realtime logic
 */

'use strict';

function setupAdminDashboardData() {

  const ctx = window.AdminDashboardContext;
  if (!ctx || !window.DashboardStatsManager) return;

  const { log, CAT, setState, getState } = ctx;
  const proto = window.DashboardStatsManager.prototype;

  proto.showFullUsersList = async function () {
    if (window.UsersListModal && typeof window.UsersListModal.show === 'function') {
      window.UsersListModal.show();
      return;
    }

    log.warn(
      'UsersListModal no está disponible. Verifica que users-list-modal.js esté cargado.',
      CAT.ADMIN
    );
  };

  proto.getOrderTimestamp = function (order) {
    const ts =
      order.createdAt ||
      order.timestamp ||
      order.purchasedAt ||
      order.created_at ||
      order.paidAt ||
      order.paymentDate ||
      order.completedAt;
    if (!ts) return null;
    if (typeof ts === 'number') return ts;
    if (ts.toDate) return ts.toDate().getTime();
    if (ts.seconds) return ts.seconds * 1000;
    return null;
  };

  proto.getOrderValue = function (order) {
    if (!order) return 0;
    const candidates = [
      { key: 'price', scale: 1 },
      { key: 'total', scale: 1 },
      { key: 'totalPrice', scale: 1 },
      { key: 'total_price', scale: 1 },
      { key: 'subtotal', scale: 1 },
      { key: 'amount_total', scale: 0.01 },
      { key: 'amountTotal', scale: 0.01 },
      { key: 'amount_cents', scale: 0.01 },
      { key: 'amountCents', scale: 0.01 },
      { key: 'price_cents', scale: 0.01 },
      { key: 'priceCents', scale: 0.01 },
      { key: 'total_cents', scale: 0.01 },
      { key: 'totalCents', scale: 0.01 },
      { key: 'amount', scale: 1 },
    ];

    for (const candidate of candidates) {
      if (order[candidate.key] === undefined || order[candidate.key] === null)
        continue;
      let raw = order[candidate.key];
      if (typeof raw === 'string') {
        raw = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
      }
      let value = parseFloat(raw);
      if (!Number.isFinite(value)) value = 0;
      value = value * candidate.scale;

      if (
        candidate.key === 'amount' &&
        Number.isInteger(value) &&
        value >= 1000 &&
        (order.currency || order.currency_code || order.provider === 'stripe')
      ) {
        value = value / 100;
      }

      return value;
    }
    return 0;
  };

  proto.getLatestOrderTimestamp = function (orders) {
    let latest = null;
    orders.forEach(order => {
      const ts = this.getOrderTimestamp(order);
      if (ts && (!latest || ts > latest)) latest = ts;
    });
    return latest;
  };

  proto.getLatestEventTimestamp = function (events) {
    let latest = null;
    events.forEach(evt => {
      const ts = evt.processedAt || evt.timestamp;
      let ms = null;
      if (!ts) return;
      if (typeof ts === 'number') ms = ts;
      else if (ts.toDate) ms = ts.toDate().getTime();
      else if (ts.seconds) ms = ts.seconds * 1000;
      if (ms && (!latest || ms > latest)) latest = ms;
    });
    return latest;
  };

  proto.formatRelativeTime = function (ms) {
    if (!ms) return 'nunca';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'hace <1 min';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
  };

  proto.getPaymentsStatus = function (lastOrderAt, lastWebhookAt) {
    if (!lastOrderAt) return 'Sin compras';
    if (lastWebhookAt) {
      const diff = Date.now() - lastWebhookAt;
      if (diff <= 30 * 60 * 1000) return 'Webhook OK';
      return 'Webhook antiguo';
    }
    return 'Webhook no detectado';
  };

  proto.getPaymentsChange = function (
    lastOrderAt,
    ordersLast24h,
    revenueLast24h,
    refundsLast24h
  ) {
    const last = this.formatRelativeTime(lastOrderAt);
    const ordersText = `${ordersLast24h} compra${ordersLast24h !== 1 ? 's' : ''} / 24h`;
    const revenueText = `€${revenueLast24h.toFixed(2)} / 24h`;
    const refundsText = `Reembolsos: ${refundsLast24h} / 24h`;
    return `Última: ${last} · ${ordersText} · ${revenueText} · ${refundsText}`;
  };

  proto.refreshPaymentsStatus = async function () {
    try {
      if (!this.db) return;
      const [ordersSnapshot, eventsSnapshot] = await Promise.all([
        this.db.collection('orders').limit(1).get(),
        this.db
          .collection('processedEvents')
          .orderBy('processedAt', 'desc')
          .limit(1)
          .get(),
      ]);

      const orders =
        ordersSnapshot && ordersSnapshot.docs
          ? ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : [];
      const events =
        eventsSnapshot && eventsSnapshot.docs
          ? eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : [];

      const lastOrderAt = this.getLatestOrderTimestamp(orders);
      const lastWebhookAt = this.getLatestEventTimestamp(events);

      this.updateStatsCache({
        lastOrderAt,
        lastWebhookAt,
        paymentsStatus: this.getPaymentsStatus(lastOrderAt, lastWebhookAt),
      });
    } catch (error) {
      log.error('Error refrescando estado de pagos', CAT.ADMIN, error);
      const paymentsChangeEl = document.getElementById('paymentsChange');
      if (paymentsChangeEl) {
        paymentsChangeEl.textContent = 'Error al actualizar';
        paymentsChangeEl.className = 'stat-change error';
      }
      if (window.NotificationSystem) {
        window.NotificationSystem.error('No se pudo actualizar pagos');
      }
    }
  };

  proto.loadUsersCountFromAuth = async function () {
    try {
      log.info('Obteniendo conteo de usuarios consistente con el modal...', CAT.ADMIN);
      const db = window.firebase?.firestore ? window.firebase.firestore() : null;
      if (!db) {
        throw new Error('Firestore no disponible');
      }

      const currentUser =
        window.firebase?.auth && typeof window.firebase.auth === 'function'
          ? window.firebase.auth().currentUser
          : null;
      if (currentUser?.getIdToken) {
        await currentUser.getIdToken(true);
      }

      let authUsers = [];
      try {
        const listUsersFunction = firebase
          .functions()
          .httpsCallable('listAdminUsers');
        const authUsersResult = await listUsersFunction();
        authUsers = authUsersResult?.data?.users || [];
      } catch (callableError) {
        log.warn(
          'listAdminUsers no disponible para conteo, usando fallback Firestore',
          CAT.ADMIN,
          callableError
        );
      }

      const usersSnapshot = await db.collection('users').get();
      const firestoreUsers = {};
      usersSnapshot.forEach(doc => {
        firestoreUsers[doc.id] = doc.data();
      });

      const sourceUsers =
        authUsers.length > 0
          ? authUsers
          : Object.entries(firestoreUsers).map(([uid, row]) => ({
              uid,
              email: row?.email || '',
              displayName: row?.displayName || row?.name || '',
            }));

      const byEmail = new Map();
      sourceUsers.forEach(user => {
        if (!user || !user.uid) return;
        const firestoreData = firestoreUsers[user.uid] || {};
        const email = String(user.email || firestoreData.email || '')
          .trim()
          .toLowerCase();
        if (!email || !email.includes('@')) return;
        const key = email || `uid:${user.uid}`;
        if (!byEmail.has(key)) {
          byEmail.set(key, true);
        }
      });

      const count = byEmail.size;
      log.info(`✅ Usuarios (criterio modal): ${count}`, CAT.ADMIN);
      this.updateStatsCache({ users: count });
    } catch (error) {
      log.error(
        'Error obteniendo conteo de usuarios desde Auth',
        CAT.FIREBASE,
        error
      );
      log.warn(
        'Usando fallback: contando desde Firestore users collection',
        CAT.ADMIN
      );
      const count = await this.getUsersCountFromFirestore();
      this.updateStatsCache({ users: count });
    }
  };

  proto.getUsersCountFromFirestore = async function () {
    try {
      const { getCountFromServer, collection } = window.firebaseModular || {};
      if (!getCountFromServer) return 0;

      const snapshot = await getCountFromServer(
        collection(window.firebaseModular.db, 'users')
      );
      return snapshot.data().count;
    } catch (error) {
      log.error('Error obteniendo conteo de usuarios', CAT.FIREBASE, error);
      return 0;
    }
  };

  proto.getVisitsCount = async function () {
    try {
      const { getCountFromServer, collection } = window.firebaseModular || {};
      if (!getCountFromServer) {
        const snapshot = await this.db.collection('analytics_visits').get();
        return snapshot.size;
      }
      const snapshot = await getCountFromServer(
        collection(window.firebaseModular.db, 'analytics_visits')
      );
      return snapshot.data().count;
    } catch (error) {
      log.error('Error obteniendo visitas', CAT.FIREBASE, error);
      return 0;
    }
  };

  proto.getProductsCount = async function () {
    try {
      const { getCountFromServer, collection } = window.firebaseModular || {};
      if (!getCountFromServer) {
        const snapshot = await this.db.collection('products').get();
        return snapshot.size;
      }
      const snapshot = await getCountFromServer(
        collection(window.firebaseModular.db, 'products')
      );
      return snapshot.data().count;
    } catch (error) {
      log.error('Error obteniendo productos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.getOrdersCount = async function () {
    try {
      const { getCountFromServer, collection } = window.firebaseModular || {};
      if (!getCountFromServer) {
        const snapshot = await this.db.collection('orders').get();
        return snapshot.size;
      }
      const snapshot = await getCountFromServer(
        collection(window.firebaseModular.db, 'orders')
      );
      return snapshot.data().count;
    } catch (error) {
      log.error('Error obteniendo pedidos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.getRevenue = async function () {
    try {
      const { query, collection, where, getDocs, db } =
        window.firebaseModular || {};
      if (!getDocs) return 0;

      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('status', '==', 'completed'));
      const snapshot = await getDocs(q);

      let total = 0;
      snapshot.forEach(doc => {
        const order = doc.data();
        total += parseFloat(order.price) || 0;
      });

      return total;
    } catch (error) {
      log.error('Error calculando ingresos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.callFunctionWithFallback = async function (baseName, data = {}) {
    if (!window.firebase?.functions) {
      throw new Error('Firebase Functions no disponible');
    }
    const candidates = [`${baseName}V2`, baseName];
    let lastError = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const fnName = candidates[i];
      try {
        const callable = window.firebase.functions().httpsCallable(fnName);
        const result = await callable(data);
        return result?.data || {};
      } catch (error) {
        lastError = error;
        const code = String(error?.code || '').toLowerCase();
        const msg = String(error?.message || '').toLowerCase();
        const canFallback =
          code.includes('not-found') ||
          code.includes('unimplemented') ||
          msg.includes('not found') ||
          msg.includes('does not exist');
        if (i === candidates.length - 1 || !canFallback) break;
      }
    }
    throw lastError || new Error('Callable no disponible');
  };

  proto.getSecuritySummaryCardData = async function (days = 7) {
    try {
      const stats = await this.callFunctionWithFallback(
        'getSecurityLogsDailyStats',
        { days }
      );
      const totals = stats?.totals || {};
      const blocked = Number(totals.registrationBlocked || 0);
      const adminActions = Number(totals.adminActions || 0);
      const daysReturned = Number(stats?.daysReturned || days);
      const topAdminActions = Array.isArray(stats?.topAdminActions)
        ? stats.topAdminActions
        : [];
      const topReason = Object.entries(stats?.byReason || {})
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 1)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join('');
      const topActionText = topAdminActions
        .slice(0, 2)
        .map(item => `${item.key}: ${item.value}`)
        .join(' | ');

      let severity = 'positive';
      if (blocked >= 150) severity = 'error';
      else if (blocked >= 50) severity = 'warning';
      else if (blocked >= 1) severity = 'neutral';

      const status = `Protección activa (${daysReturned}d)`;
      const change = `Bloqueos: ${blocked} · Acciones admin: ${adminActions}${
        topReason ? ` · ${topReason}` : ''
      }`;

      return {
        securityStatus: status,
        securityChange: change,
        securitySeverity: severity,
        securityTopStatus: `Top acciones (${daysReturned}d)`,
        securityTopChange: topActionText || 'Sin acciones registradas',
        securityTopSeverity:
          topAdminActions.length > 0 ? 'positive' : 'neutral',
      };
    } catch (error) {
      log.warn(
        'No se pudo cargar resumen de seguridad diario para dashboard',
        CAT.ADMIN,
        error
      );
      return {
        securityStatus: 'Sin datos',
        securityChange: 'Estadísticas de seguridad no disponibles',
        securitySeverity: 'neutral',
        securityTopStatus: 'Top acciones 7d',
        securityTopChange: 'No disponible',
        securityTopSeverity: 'neutral',
      };
    }
  };

  proto.refreshSecuritySummary = async function (days = 7) {
    const snapshot = await this.getSecuritySummaryCardData(days);
    this.updateStatsCache(snapshot);
  };

  proto.loadStats = async function () {
    try {
      log.info('Cargando estadísticas del dashboard...', CAT.ADMIN);

      const user = await this.waitForAuth();
      if (!user) {
        log.warn(
          'No se puede cargar estadísticas: usuario no autenticado',
          CAT.ADMIN
        );
        this.showAuthError();
        return;
      }

      const isAdmin = await this.checkAdminStatus();
      if (!isAdmin) {
        log.warn(
          'No se puede cargar estadísticas: usuario no es administrador',
          CAT.ADMIN
        );
        this.showPermissionError();
        return;
      }

      const container = document.getElementById('dashboardStatsContainer');
      if (container) {
        const existingError = container.querySelector(
          '.stats-error, .stats-auth-error, .stats-permission-error'
        );
        if (existingError) existingError.remove();
      }

      const results = await Promise.allSettled([
        this.getUsersCountFromFirestore(),
        this.getVisitsCount(),
        this.getProductsCount(),
        this.getOrdersCount(),
        this.getRevenue(),
        this.getSecuritySummaryCardData(7),
      ]);

      const usersCount =
        results[0].status === 'fulfilled' ? results[0].value : 0;
      const visitsCount =
        results[1].status === 'fulfilled' ? results[1].value : 0;
      const productsCount =
        results[2].status === 'fulfilled' ? results[2].value : 0;
      const ordersCount =
        results[3].status === 'fulfilled' ? results[3].value : 0;
      const revenue =
        results[4].status === 'fulfilled' ? results[4].value : 0;
      const securitySummary =
        results[5].status === 'fulfilled'
          ? results[5].value
          : {
              securityStatus: 'Sin datos',
              securityChange: 'Estadísticas no disponibles',
              securitySeverity: 'neutral',
              securityTopStatus: 'Top acciones 7d',
              securityTopChange: 'No disponible',
              securityTopSeverity: 'neutral',
            };

      const permissionError = results.find(
        r =>
          r.status === 'rejected' &&
          r.reason &&
          r.reason.code === 'permission-denied'
      );
      if (permissionError) {
        log.error(
          'Error de permisos detectado en queries de Firestore',
          CAT.FIREBASE,
          permissionError.reason
        );
        this.showError('firestore', permissionError.reason);
        return;
      }

      const stats = {
        users: usersCount,
        visits: visitsCount,
        products: productsCount,
        orders: ordersCount,
        revenue: revenue,
        securityStatus: securitySummary.securityStatus,
        securityChange: securitySummary.securityChange,
        securitySeverity: securitySummary.securitySeverity,
        securityTopStatus: securitySummary.securityTopStatus,
        securityTopChange: securitySummary.securityTopChange,
        securityTopSeverity: securitySummary.securityTopSeverity,
        lastUpdated: new Date().toISOString(),
      };

      setState('admin.stats', stats);
      this.updateStatsUI(stats);
      log.info(
        'Estadísticas cargadas y guardadas en AppState',
        CAT.ADMIN,
        stats
      );
    } catch (error) {
      log.error('Error al cargar estadísticas', CAT.ADMIN, error);
      this.showError('general', error);
    }
  };

  proto.initRealTimeStats = async function () {
    if (this.realTimeInitialized) {
      log.trace('Real-time ya inicializado, evitando duplicación', CAT.INIT);
      return;
    }

    this.showLoadingState();
    const maxRetries = 5;
    const baseDelay = 300;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const user = await this.waitForAuth();
        if (!user) {
          log.warn(
            'No se puede cargar estadísticas: usuario no autenticado',
            CAT.ADMIN
          );
          this.clearLoadingState();
          this.showAuthError();
          return;
        }

        const isAdmin = await this.checkAdminStatus();
        if (!isAdmin) {
          log.warn(
            'No se puede cargar estadísticas: usuario no es administrador',
            CAT.ADMIN
          );
          this.clearLoadingState();
          this.showPermissionError();
          return;
        }

        if (!window.realTimeDataService) {
          log.warn(
            `RealTimeDataService no disponible (intento ${attempt})`,
            CAT.INIT
          );
          if (attempt < maxRetries) {
            await new Promise(resolve =>
              setTimeout(resolve, baseDelay * attempt)
            );
            continue;
          }
          log.warn(
            'RealTimeDataService no disponible, usando fallback a carga estática',
            CAT.INIT
          );
          await this.loadStats();
          this.clearLoadingState();
          return;
        }

        await window.realTimeDataService.init();
        log.info(
          'Suscribiendo a colecciones en tiempo real...',
          CAT.FIREBASE
        );

        this.loadUsersCountFromAuth();

        this.realTimeUnsubscribe =
          window.realTimeDataService.subscribeToMultiple({
            analytics_visits: {
              callback: snapshot => {
                const visits =
                  snapshot && snapshot.docs
                    ? snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                      }))
                    : [];

                const botPatterns = [
                  /bot/i,
                  /crawler/i,
                  /spider/i,
                  /scraper/i,
                  /googlebot/i,
                  /bingbot/i,
                  /yandexbot/i,
                  /facebookexternalhit/i,
                  /twitterbot/i,
                  /linkedinbot/i,
                  /slackbot/i,
                  /discordbot/i,
                  /redditbot/i,
                ];

                const validVisits = visits.filter(visit => {
                  const ua = visit.userAgent || '';
                  const isAdmin = visit.isAdmin === true;
                  const isBot = botPatterns.some(pattern => pattern.test(ua));
                  const hasValidUA = ua && ua.length > 10;

                  return hasValidUA && !isBot && !isAdmin;
                });

                const count = validVisits.length;
                console.info(
                  `[TIEMPO REAL] Visitas actualizadas: ${count} (de ${visits.length} totales)`,
                  'ADMIN'
                );

                this.updateStatsCache({
                  visits: count,
                });

                const visitsElement = document.getElementById('visitsCount');
                if (visitsElement) {
                  const startValue =
                    parseInt(visitsElement.textContent.replace(/,/g, '')) || 0;
                  this.animateValue(visitsElement, startValue, count, 1000);
                }
              },
              options: {
                limit: 10000,
              },
            },
            orders: snapshot => {
              const orders =
                snapshot && snapshot.docs
                  ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                  : [];
              const count = orders.length;
              const revenue = orders.reduce((sum, order) => {
                const status = String(order.status || '').toLowerCase();
                if (status !== 'completed') return sum;
                return sum + this.getOrderValue(order);
              }, 0);
              const now = Date.now();
              const lastOrderAt = this.getLatestOrderTimestamp(orders);
              const ordersLast24h = orders.filter(order => {
                const ts = this.getOrderTimestamp(order);
                return ts && now - ts <= 24 * 60 * 60 * 1000;
              }).length;
              const revenueLast24h = orders.reduce((sum, order) => {
                const ts = this.getOrderTimestamp(order);
                const status = String(order.status || '').toLowerCase();
                if (status !== 'completed') return sum;
                if (ts && now - ts <= 24 * 60 * 60 * 1000) {
                  return sum + this.getOrderValue(order);
                }
                return sum;
              }, 0);
              const refundsLast24h = orders.filter(order => {
                const ts = this.getOrderTimestamp(order);
                return (
                  ts &&
                  now - ts <= 24 * 60 * 60 * 1000 &&
                  String(order.status || '').toLowerCase() === 'refunded'
                );
              }).length;
              log.trace(
                `[TIEMPO REAL] Pedidos: ${count}, Ingresos: €${revenue.toFixed(2)}`,
                CAT.ADMIN
              );

              this.updateStatsCache({
                orders: count,
                revenue: revenue,
                lastOrderAt: lastOrderAt,
                paymentsStatus: this.getPaymentsStatus(
                  lastOrderAt,
                  getState('admin.stats')?.lastWebhookAt || null
                ),
                paymentsChange: this.getPaymentsChange(
                  lastOrderAt,
                  ordersLast24h,
                  revenueLast24h,
                  refundsLast24h
                ),
              });

              const ordersElement = document.getElementById('ordersCount');
              if (ordersElement) {
                const startValue =
                  parseInt(ordersElement.textContent.replace(/,/g, '')) || 0;
                this.animateValue(ordersElement, startValue, count, 1000);
              }

              const revenueElement = document.getElementById('revenueAmount');
              if (revenueElement) {
                const startValue =
                  parseFloat(
                    revenueElement.textContent.replace(/[€,]/g, '')
                  ) || 0;
                this.animateValue(
                  revenueElement,
                  startValue,
                  revenue,
                  1000,
                  true
                );
              }
            },
            processedEvents: {
              callback: snapshot => {
                const events =
                  snapshot && snapshot.docs
                    ? snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                      }))
                    : [];
                const lastWebhookAt = this.getLatestEventTimestamp(events);
                this.updateStatsCache({
                  lastWebhookAt: lastWebhookAt,
                  paymentsStatus: this.getPaymentsStatus(
                    getState('admin.stats')?.lastOrderAt || null,
                    lastWebhookAt
                  ),
                });
              },
              options: {
                orderBy: 'processedAt',
                limit: 1,
              },
            },
            activities: {
              callback: snapshot => {
                const items =
                  snapshot && snapshot.docs
                    ? snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                      }))
                    : [];
              },
              options: {
                orderBy: 'timestamp',
                limit: 50,
              },
            },
            announcements: snapshot => {
              const announcements =
                snapshot && snapshot.docs
                  ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                  : [];
              const count = announcements.length;
              log.trace(
                `[TIEMPO REAL] Anuncios actualizados: ${count}`,
                CAT.ADMIN
              );

              this.updateStatsCache({
                products: count,
              });

              const productsElement = document.getElementById('productsCount');
              if (productsElement) {
                const startValue =
                  parseInt(productsElement.textContent.replace(/,/g, '')) || 0;
                this.animateValue(productsElement, startValue, count, 1000);
              }
            },
          });

        log.info(
          'Estadísticas en TIEMPO REAL inicializadas exitosamente',
          CAT.ADMIN
        );
        this.refreshSecuritySummary(7).catch(error => {
          log.warn(
            'No se pudo refrescar resumen de seguridad en tiempo real',
            CAT.ADMIN,
            error
          );
        });

        this.realTimeInitialized = true;
        this.clearLoadingState();
        return;
      } catch (error) {
        log.error(
          `Error inicializando estadísticas en tiempo real (intento ${attempt})`,
          CAT.ADMIN,
          error
        );

        if (attempt === maxRetries) {
          log.warn(
            'Todos los intentos de real-time fallaron, usando fallback a carga estática',
            CAT.INIT
          );
          await this.loadStats();
          this.clearLoadingState();
          return;
        }

        await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
      }
    }
  };

  proto.resetVisits = async function () {
    if (
      !confirm(
        '⚠️ ¡ATENCIÓN! ¿Estás seguro de que deseas ELIMINAR todas las visitas registradas?\n\nEsta acción borrará permanentemente el historial de tráfico y el contador volverá a 0.'
      )
    ) {
      return;
    }

    try {
      log.info('Restableciendo visitas...', CAT.ADMIN);

      const { collection, getDocs, writeBatch, db } =
        window.firebaseModular || {};
      if (!getDocs || !writeBatch) {
        log.error(
          'Firebase Modular no disponible para resetVisits',
          CAT.FIREBASE
        );
        return;
      }

      const visitsCol = collection(db, 'analytics_visits');
      const snapshot = await getDocs(visitsCol);

      if (snapshot.empty) {
        log.info('No hay visitas para restablecer.', CAT.ADMIN);
        return;
      }

      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      if (window.NotificationSystem) {
        window.NotificationSystem.show(
          'Visitas restablecidas correctamente',
          'success'
        );
      }

      await this.initRealTimeStats();
    } catch (error) {
      console.error('❌ Error al restablecer visitas:', error);

      let errorMsg = 'Error al restablecer visitas';
      if (error.code === 'permission-denied') {
        errorMsg =
          '❌ Error de Permisos: Verifica las reglas de Firestore en tu consola Firebase.';
      }

      if (window.NotificationSystem) {
        window.NotificationSystem.show(errorMsg, 'error');
      } else {
        alert(errorMsg);
      }
    }
  };

  proto.exportAllData = async function () {
    log.startGroup('Data Export', '📦', true);
    try {
      log.info('Exportando todos los datos del sistema...', CAT.ADMIN);

      if (window.NotificationSystem) {
        window.NotificationSystem.show('Exportando datos...', 'info');
      }

      const exportData = {
        timestamp: new Date().toISOString(),
        stats:
          window.AppState && window.AppState.getState
            ? window.AppState.getState('admin.stats')
            : {},
        users: [],
        announcements: [],
        products: [],
      };

      try {
        const usersSnapshot = await this.db.collection('users').get();
        usersSnapshot.forEach(doc => {
          exportData.users.push({
            id: doc.id,
            ...doc.data(),
          });
        });
      } catch (error) {
        Logger.error('Error exportando usuarios', 'ADMIN', error);
      }

      try {
        const announcementsSnapshot = await this.db
          .collection('announcements')
          .get();
        announcementsSnapshot.forEach(doc => {
          exportData.announcements.push({
            id: doc.id,
            ...doc.data(),
          });
        });
      } catch (error) {
        Logger.error('Error exportando anuncios', 'ADMIN', error);
      }

      try {
        const productsSnapshot = await this.db.collection('products').get();
        productsSnapshot.forEach(doc => {
          exportData.products.push({
            id: doc.id,
            ...doc.data(),
          });
        });
      } catch (error) {
        Logger.error('Error exportando productos', 'ADMIN', error);
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const siteName =
        window.AdminSettingsCache?.general?.siteName ||
        window.AppState?.state?.settings?.general?.siteName ||
        'export';
      const safeName = String(siteName)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      link.download = `${safeName || 'export'}_${new Date()
        .toISOString()
        .split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      log.info('Datos exportados correctamente', CAT.ADMIN);
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Datos exportados correctamente');
      }
    } catch (error) {
      log.error('Error al exportar datos', CAT.ADMIN, error);
      if (window.NotificationSystem) {
        window.NotificationSystem.error('Error al exportar datos');
      } else {
        alert('Error al exportar datos: ' + error.message);
      }
    } finally {
      log.endGroup('Data Export');
    }
  };

  proto.refresh = async function () {
    log.info('Recargando estadísticas...', CAT.ADMIN);

    const container = document.getElementById('dashboardStatsContainer');
    if (container) {
      const existingError = container.querySelector(
        '.stats-error, .stats-auth-error, .stats-permission-error'
      );
      if (existingError) {
        existingError.remove();
      }
    }

    await this.initRealTimeStats();
  };
}

export function initAdminDashboardData() {
  if (window.__ADMIN_DASHBOARD_DATA_INITED__) {
    return;
  }

  window.__ADMIN_DASHBOARD_DATA_INITED__ = true;
  setupAdminDashboardData();
}

if (typeof window !== 'undefined' && !window.__ADMIN_DASHBOARD_DATA_NO_AUTO__) {
  initAdminDashboardData();
}

