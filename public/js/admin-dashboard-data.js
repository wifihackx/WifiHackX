/**
 * Admin Dashboard - Data + realtime logic
 */

'use strict';

function setupAdminDashboardData() {
  const ctx = window.AdminDashboardContext;
  if (!ctx || !window.DashboardStatsManager) return;

  const { log, CAT, setState, getState } = ctx;
  const proto = window.DashboardStatsManager.prototype;
  const getCompatDb = () =>
    window.firebase?.firestore && typeof window.firebase.firestore === 'function'
      ? window.firebase.firestore()
      : null;
  const getModularApi = () => window.firebaseModular || {};

  const getCollectionSnapshot = async name => {
    const mod = getModularApi();
    if (mod.getDocs && mod.collection && mod.db) {
      return mod.getDocs(mod.collection(mod.db, name));
    }
    const compatDb = getCompatDb();
    if (compatDb) {
      return compatDb.collection(name).get();
    }
    return null;
  };

  const getCollectionGroupSnapshot = async name => {
    const mod = getModularApi();
    if (mod.collectionGroup && mod.getDocs && mod.db) {
      return mod.getDocs(mod.collectionGroup(mod.db, name));
    }
    const compatDb = getCompatDb();
    if (compatDb && typeof compatDb.collectionGroup === 'function') {
      return compatDb.collectionGroup(name).get();
    }
    return null;
  };

  const getUserDocData = async uid => {
    const safeUid = String(uid || '').trim();
    if (!safeUid) return null;
    const mod = getModularApi();
    if (mod.doc && mod.getDoc && mod.db) {
      const snap = await mod.getDoc(mod.doc(mod.db, 'users', safeUid));
      return snap?.exists() ? snap.data() || {} : null;
    }
    const compatDb = getCompatDb();
    if (compatDb) {
      const snap = await compatDb.collection('users').doc(safeUid).get();
      return snap?.exists ? snap.data() || {} : null;
    }
    return null;
  };

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
    const defaultCandidates = [
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

    const hasStripeSignals =
      String(order.provider || order.source || order.paymentMethod || '')
        .toLowerCase()
        .includes('stripe') ||
      !!order.sessionId ||
      order.amount_total !== undefined ||
      order.amount_cents !== undefined ||
      order.total_cents !== undefined;

    const candidates = hasStripeSignals
      ? [
          { key: 'amount_total', scale: 0.01 },
          { key: 'amountTotal', scale: 0.01 },
          { key: 'amount_cents', scale: 0.01 },
          { key: 'amountCents', scale: 0.01 },
          { key: 'total_cents', scale: 0.01 },
          { key: 'totalCents', scale: 0.01 },
          ...defaultCandidates,
        ]
      : defaultCandidates;

    for (const candidate of candidates) {
      if (order[candidate.key] === undefined || order[candidate.key] === null) continue;
      let raw = order[candidate.key];
      const rawString = typeof raw === 'string' ? raw : '';
      if (typeof raw === 'string') {
        raw = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
      }
      let value = parseFloat(raw);
      if (!Number.isFinite(value)) value = 0;
      value = value * candidate.scale;

      if (
        ['amount', 'price', 'total', 'totalPrice', 'total_price'].includes(candidate.key) &&
        Number.isInteger(value) &&
        value >= 1000 &&
        !rawString.includes('.') &&
        !rawString.includes(',') &&
        (order.currency || order.currency_code || hasStripeSignals)
      ) {
        value = value / 100;
      }

      return value;
    }
    return 0;
  };

  proto.isSuccessfulOrderStatus = function (status) {
    const normalized = String(status || 'completed')
      .trim()
      .toLowerCase();
    if (!normalized) return true;
    return [
      'completed',
      'complete',
      'paid',
      'succeeded',
      'success',
      'approved',
      'captured',
      'authorized',
      'active',
    ].includes(normalized);
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
    const stripeConfigured =
      window.RuntimeConfigUtils &&
      typeof window.RuntimeConfigUtils.isStripeConfigured === 'function'
        ? window.RuntimeConfigUtils.isStripeConfigured()
        : typeof window.STRIPE_PUBLIC_KEY === 'string' && !!window.STRIPE_PUBLIC_KEY.trim();
    if (!stripeConfigured) return 'Stripe no configurado';
    if (!lastOrderAt) return 'Sin compras';
    if (lastWebhookAt) {
      const diff = Date.now() - lastWebhookAt;
      if (diff <= 30 * 60 * 1000) return 'Webhook OK';
      return 'Webhook antiguo';
    }
    return 'Webhook no detectado';
  };

  proto.getPaymentsChange = function (lastOrderAt, ordersLast24h, revenueLast24h, refundsLast24h) {
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
        this.db.collection('orders').limit(200).get(),
        this.db.collection('processedEvents').orderBy('processedAt', 'desc').limit(1).get(),
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
      const count = await this.getUsersCountFromFirestore();
      log.info(`✅ Usuarios (criterio unificado): ${count}`, CAT.ADMIN);
      this.updateStatsCache({ users: count });
    } catch (error) {
      log.error('Error obteniendo conteo de usuarios', CAT.FIREBASE, error);
    }
  };

  proto.getUsersCountFromFirestore = async function () {
    try {
      const usersSnapshot = await getCollectionSnapshot('users');
      if (!usersSnapshot) return 0;

      let authUsers = [];
      try {
        if (window.firebase?.functions) {
          const callable = window.firebase.functions().httpsCallable('listAdminUsers');
          const result = await callable();
          authUsers = Array.isArray(result?.data?.users) ? result.data.users : [];
        }
      } catch (_e) {
        authUsers = [];
      }

      const firestoreUsers = {};
      usersSnapshot.forEach(doc => {
        firestoreUsers[doc.id] = doc.data() || {};
      });

      const firestoreSourceUsers = Object.entries(firestoreUsers).map(([uid, row]) => ({
        uid,
        email: row?.email || '',
        displayName: row?.displayName || row?.name || '',
        customClaims: row?.customClaims || {},
      }));
      // Unir Auth + Firestore para evitar perder usuarios cuando una fuente va retrasada.
      const sourceUsers = [];
      const seenUids = new Set();
      authUsers.forEach(user => {
        const uid = String(user?.uid || '').trim();
        if (!uid || seenUids.has(uid)) return;
        seenUids.add(uid);
        sourceUsers.push(user);
      });
      firestoreSourceUsers.forEach(user => {
        const uid = String(user?.uid || '').trim();
        if (!uid || seenUids.has(uid)) return;
        seenUids.add(uid);
        // Mantener forma compatible con la rama de Auth.
        sourceUsers.push({
          uid,
          email: user.email,
          displayName: user.displayName,
          customClaims: user.customClaims || {},
        });
      });

      const byEmail = new Map();
      sourceUsers.forEach(sourceUser => {
        const uid = String(sourceUser?.uid || '').trim();
        if (!uid) return;
        const firestoreData = firestoreUsers[uid] || {};
        const claimRole = String(sourceUser?.customClaims?.role || '').toLowerCase();
        const firestoreRole = String(firestoreData?.role || '').toLowerCase();
        const isAdmin =
          sourceUser?.customClaims?.admin === true ||
          claimRole === 'admin' ||
          claimRole === 'super_admin' ||
          firestoreRole === 'admin' ||
          firestoreRole === 'super_admin';
        const email = String(sourceUser?.email || firestoreData?.email || '')
          .trim()
          .toLowerCase();
        const hasValidEmail = email.includes('@');
        if (!hasValidEmail && !isAdmin) return;
        const key = hasValidEmail ? email : `uid:${uid}`;
        if (!byEmail.has(key)) byEmail.set(key, true);
      });

      return byEmail.size;
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
      const snapshot = await getCountFromServer(collection(window.firebaseModular.db, 'products'));
      return snapshot.data().count;
    } catch (error) {
      log.error('Error obteniendo productos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.getOrdersCount = async function () {
    try {
      const snapshot = await getCollectionSnapshot('orders');
      if (!snapshot) return 0;
      let total = 0;
      snapshot.forEach(doc => {
        const row = doc.data() || {};
        if (this.isSuccessfulOrderStatus(row.status)) total += 1;
      });
      return total;
    } catch (error) {
      log.error('Error obteniendo pedidos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.getRevenue = async function () {
    try {
      const snapshot = await getCollectionSnapshot('orders');
      if (!snapshot) {
        return 0;
      }

      let total = 0;
      snapshot.forEach(doc => {
        const order = doc.data();
        if (!this.isSuccessfulOrderStatus(order?.status)) return;
        total += this.getOrderValue(order);
      });

      return total;
    } catch (error) {
      log.error('Error calculando ingresos', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') throw error;
      return 0;
    }
  };

  proto.getFallbackPurchasesMetrics = async function () {
    try {
      const snapshot = await getCollectionGroupSnapshot('purchases');
      if (snapshot) {
        let count = 0;
        let revenue = 0;
        snapshot.forEach(doc => {
          const row = doc.data() || {};
          if (!this.isSuccessfulOrderStatus(row.status)) return;
          count += 1;
          revenue += this.getOrderValue(row);
        });
        if (count > 0 || revenue > 0) {
          return { count, revenue, source: 'users.purchases' };
        }
      }
    } catch (error) {
      log.warn('Fallback collectionGroup purchases no disponible', CAT.ADMIN, error);
    }

    return await this.getCurrentUserPurchasesArrayMetrics();
  };

  proto.getCurrentUserPurchasesArrayMetrics = async function () {
    try {
      const toAmount = value => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
          const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
          return Number.isFinite(parsed) ? parsed : 0;
        }
        if (typeof value === 'object') {
          if (typeof value.toNumber === 'function') {
            const n = Number(value.toNumber());
            return Number.isFinite(n) ? n : 0;
          }
          const parsed = Number(String(value));
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const authUser =
        window.firebase?.auth?.()?.currentUser || window.firebaseModular?.auth?.currentUser || null;
      const uid = String(authUser?.uid || '').trim();
      if (!uid) return { count: 0, revenue: 0, source: 'none' };

      const userRow = await getUserDocData(uid);

      const list = Array.isArray(userRow?.purchases) ? userRow.purchases : [];
      const purchaseMeta =
        userRow?.purchaseMeta && typeof userRow.purchaseMeta === 'object'
          ? userRow.purchaseMeta
          : {};
      let revenue = 0;
      Object.values(purchaseMeta).forEach(entry => {
        const metaAmount = toAmount(entry?.amount);
        if (Number.isFinite(metaAmount) && metaAmount > 0) revenue += metaAmount;
      });

      if (revenue <= 0 && list.length > 0) {
        for (const pid of list) {
          const productId = String(pid || '').trim();
          if (!productId) continue;
          try {
            if (window.firebase?.firestore) {
              const annDoc = await window.firebase
                .firestore()
                .collection('announcements')
                .doc(productId)
                .get();
              const ann = annDoc?.exists ? annDoc.data() || {} : {};
              const amount = toAmount(ann.price ?? ann.amount ?? 0);
              if (amount > 0) revenue += amount;
            } else if (
              window.firebaseModular?.doc &&
              window.firebaseModular?.getDoc &&
              window.firebaseModular?.db
            ) {
              const mod = window.firebaseModular;
              const annDoc = await mod.getDoc(mod.doc(mod.db, 'announcements', productId));
              const ann = annDoc?.exists() ? annDoc.data() || {} : {};
              const amount = toAmount(ann.price ?? ann.amount ?? 0);
              if (amount > 0) revenue += amount;
            }
          } catch (_e) {}
        }
      }

      return {
        count: list.length,
        revenue: Number(revenue || 0),
        source:
          list.length > 0
            ? revenue > 0
              ? 'users.purchases.self'
              : 'users.purchases.self-count'
            : 'none',
      };
    } catch (_e) {
      return { count: 0, revenue: 0, source: 'none' };
    }
  };

  proto.getDashboardSnapshotFromServer = async function (days = 7) {
    try {
      if (!window.firebase?.functions) return null;
      const callable = window.firebase.functions().httpsCallable('getAdminDashboardSnapshot');
      const result = await callable({ days });
      if (result?.data?.success) return result.data;
      return null;
    } catch (error) {
      log.warn('Snapshot de dashboard no disponible desde server', CAT.ADMIN, error);
      return null;
    }
  };

  proto.loadStats = async function () {
    try {
      log.info('Cargando estadísticas del dashboard...', CAT.ADMIN);

      const user = await this.waitForAuth();
      if (!user) {
        log.warn('No se puede cargar estadísticas: usuario no autenticado', CAT.ADMIN);
        this.showAuthError();
        return;
      }

      const isAdmin = await this.checkAdminStatus();
      if (!isAdmin) {
        log.warn('No se puede cargar estadísticas: usuario no es administrador', CAT.ADMIN);
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
      ]);

      const usersCount = results[0].status === 'fulfilled' ? results[0].value : 0;
      const visitsCount = results[1].status === 'fulfilled' ? results[1].value : 0;
      const productsCount = results[2].status === 'fulfilled' ? results[2].value : 0;
      const ordersCount = results[3].status === 'fulfilled' ? results[3].value : 0;
      let revenue = results[4].status === 'fulfilled' ? results[4].value : 0;

      const permissionError = results.find(
        r => r.status === 'rejected' && r.reason && r.reason.code === 'permission-denied'
      );
      if (permissionError) {
        const snapshot = await this.getDashboardSnapshotFromServer(7);
        if (snapshot) {
          const stats = {
            users: snapshot.usersCount || usersCount,
            visits: visitsCount,
            products: productsCount,
            orders: snapshot.ordersCount || 0,
            revenue: Number(snapshot.revenue || 0),
            metricsSource: snapshot.metricsSource || 'server-snapshot',
            lastOrderAt: snapshot.lastOrderAt || null,
            lastUpdated: new Date().toISOString(),
          };
          setState('admin.stats', stats);
          this.updateStatsUI(stats);
          return;
        }
        log.error(
          'Error de permisos detectado en queries de Firestore',
          CAT.FIREBASE,
          permissionError.reason
        );
        this.showError('firestore', permissionError.reason);
        return;
      }

      let localOrders = Number(ordersCount || 0);
      let localRevenue = Number(revenue || 0);
      let localSource = 'orders';

      if (localOrders === 0) {
        const fallbackMetrics = await this.getFallbackPurchasesMetrics();
        if (fallbackMetrics.count > 0 || fallbackMetrics.revenue > 0) {
          localOrders = Number(fallbackMetrics.count || 0);
          localRevenue = Number(fallbackMetrics.revenue || 0);
          localSource = fallbackMetrics.source || 'users.purchases';
        }
      }

      const snapshot = await this.getDashboardSnapshotFromServer(7);
      const snapshotOrders = Number(snapshot?.ordersCount);
      const snapshotRevenue = Number(snapshot?.revenue);
      const hasLocalMetrics = localOrders > 0 || localRevenue > 0;
      const useSnapshot =
        !hasLocalMetrics &&
        Number.isFinite(snapshotOrders) &&
        Number.isFinite(snapshotRevenue) &&
        (snapshotOrders > 0 || snapshotRevenue > 0);
      const resolvedOrders = useSnapshot ? snapshotOrders : localOrders;
      const resolvedRevenue = useSnapshot ? snapshotRevenue : localRevenue;
      const metricsSource = useSnapshot
        ? snapshot?.metricsSource || 'server-snapshot'
        : localSource;
      const lastOrderAt = snapshot?.lastOrderAt || null;

      const stats = {
        users: usersCount,
        visits: visitsCount,
        products: productsCount,
        orders: resolvedOrders,
        revenue: resolvedRevenue,
        lastOrderAt,
        metricsSource,
        lastUpdated: new Date().toISOString(),
      };

      // No degradar métricas de compras/ingresos a 0 por fallos transitorios
      // de permisos/sincronización cuando ya existe un valor válido en estado.
      const prevStats = getState('admin.stats') || {};
      const prevOrders = Number(prevStats.orders || 0);
      const prevRevenue = Number(prevStats.revenue || 0);
      const prevVisits = Number(prevStats.visits || 0);
      if (Number(stats.visits || 0) < prevVisits) {
        stats.visits = prevVisits;
      }
      if (Number(stats.orders || 0) === 0 && prevOrders > 0) {
        stats.orders = prevOrders;
        if (!stats.metricsSource || stats.metricsSource === 'orders') {
          stats.metricsSource = prevStats.metricsSource || 'cached';
        }
      }
      if (Number(stats.revenue || 0) === 0 && prevRevenue > 0) {
        stats.revenue = prevRevenue;
      }

      if (Number(stats.orders || 0) === 0 || Number(stats.revenue || 0) === 0) {
        const selfMetrics = await this.getCurrentUserPurchasesArrayMetrics();
        if (Number(selfMetrics.count || 0) > Number(stats.orders || 0)) {
          stats.orders = Number(selfMetrics.count || 0);
        }
        if (Number(selfMetrics.revenue || 0) > Number(stats.revenue || 0)) {
          stats.revenue = Number(selfMetrics.revenue || 0);
        }
        if (
          (Number(selfMetrics.count || 0) > 0 || Number(selfMetrics.revenue || 0) > 0) &&
          selfMetrics.source &&
          selfMetrics.source !== 'none'
        ) {
          stats.metricsSource = selfMetrics.source;
        }
      }

      setState('admin.stats', stats);
      this.updateStatsUI(stats);
      log.info('Estadísticas cargadas y guardadas en AppState', CAT.ADMIN, stats);
    } catch (error) {
      log.error('Error al cargar estadísticas', CAT.ADMIN, error);
      this.showError('general', error);
    }
  };

  proto.initRealTimeStats = async function (options = {}) {
    const forceReload = options === true || options.force === true;
    if (this.realTimeInitialized && !forceReload) {
      log.trace('Real-time ya inicializado, evitando duplicación', CAT.INIT);
      return;
    }
    if (forceReload && this.realTimeUnsubscribe) {
      try {
        this.realTimeUnsubscribe();
      } catch (_e) {}
      this.realTimeUnsubscribe = null;
      this.realTimeInitialized = false;
    }

    this.showLoadingState();
    const maxRetries = 5;
    const baseDelay = 300;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const user = await this.waitForAuth();
        if (!user) {
          log.warn('No se puede cargar estadísticas: usuario no autenticado', CAT.ADMIN);
          this.clearLoadingState();
          this.showAuthError();
          return;
        }

        const isAdmin = await this.checkAdminStatus();
        if (!isAdmin) {
          log.warn('No se puede cargar estadísticas: usuario no es administrador', CAT.ADMIN);
          this.clearLoadingState();
          this.showPermissionError();
          return;
        }

        if (!window.realTimeDataService) {
          log.warn(`RealTimeDataService no disponible (intento ${attempt})`, CAT.INIT);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
            continue;
          }
          log.warn('RealTimeDataService no disponible, usando fallback a carga estática', CAT.INIT);
          await this.loadStats();
          this.clearLoadingState();
          return;
        }

        await window.realTimeDataService.init();
        log.info('Suscribiendo a colecciones en tiempo real...', CAT.FIREBASE);

        this.loadUsersCountFromAuth();

        this.realTimeUnsubscribe = window.realTimeDataService.subscribeToMultiple({
          analytics_visits: {
            callback: async snapshot => {
              const visits =
                snapshot && snapshot.docs
                  ? snapshot.docs.map(doc => ({
                      id: doc.id,
                      ...doc.data(),
                    }))
                  : [];
              let count = visits.length;
              try {
                const preciseCount = await this.getVisitsCount();
                if (Number.isFinite(preciseCount) && preciseCount >= 0) {
                  count = Number(preciseCount);
                }
              } catch (_e) {}
              const currentVisits = Number(getState('admin.stats')?.visits || 0);
              const resolvedVisits = Math.max(count, currentVisits);
              console.info(`[TIEMPO REAL] Visitas actualizadas: ${resolvedVisits}`, 'ADMIN');

              this.updateStatsCache({
                visits: resolvedVisits,
              });

              const visitsElement = document.getElementById('visitsCount');
              if (visitsElement) {
                const startValue = parseInt(visitsElement.textContent.replace(/,/g, '')) || 0;
                this.animateValue(visitsElement, startValue, resolvedVisits, 1000);
              }
            },
            options: {
              limit: 10000,
            },
          },
          orders: {
            callback: async snapshot => {
              const allOrders =
                snapshot && snapshot.docs
                  ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                  : [];
              const orders = allOrders.filter(order => this.isSuccessfulOrderStatus(order.status));
              const count = orders.length;
              if (count === 0) {
                const fallbackMetrics = await this.getFallbackPurchasesMetrics();
                const fallbackCount = Number(fallbackMetrics?.count || 0);
                const fallbackRevenue = Number(fallbackMetrics?.revenue || 0);
                const hasFallback = fallbackCount > 0 || fallbackRevenue > 0;
                const currentStats = getState('admin.stats') || {};
                const currentOrders = Number(currentStats.orders || 0);
                const currentRevenue = Number(currentStats.revenue || 0);
                const currentSource = String(currentStats.metricsSource || '').toLowerCase();

                if (
                  !hasFallback &&
                  (currentOrders > 0 || currentRevenue > 0) &&
                  currentSource.includes('users.purchases')
                ) {
                  return;
                }
                this.updateStatsCache({
                  orders: hasFallback ? fallbackCount : 0,
                  revenue: hasFallback ? fallbackRevenue : 0,
                  metricsSource: hasFallback
                    ? fallbackMetrics?.source || 'users.purchases'
                    : 'orders',
                  lastOrderAt: null,
                  paymentsStatus: this.getPaymentsStatus(
                    null,
                    getState('admin.stats')?.lastWebhookAt || null
                  ),
                  paymentsChange: this.getPaymentsChange(null, 0, 0, 0),
                });
                return;
              }
              const revenue = orders.reduce((sum, order) => {
                if (!this.isSuccessfulOrderStatus(order.status)) return sum;
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
                if (!this.isSuccessfulOrderStatus(order.status)) return sum;
                if (ts && now - ts <= 24 * 60 * 60 * 1000) {
                  return sum + this.getOrderValue(order);
                }
                return sum;
              }, 0);
              const refundsLast24h = allOrders.filter(order => {
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
                metricsSource: 'orders',
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
                const startValue = parseInt(ordersElement.textContent.replace(/,/g, '')) || 0;
                this.animateValue(ordersElement, startValue, count, 1000);
              }

              const revenueElement = document.getElementById('revenueAmount');
              if (revenueElement) {
                const startValue = parseFloat(revenueElement.textContent.replace(/[€,]/g, '')) || 0;
                this.animateValue(revenueElement, startValue, revenue, 1000, true);
              }
            },
            options: {
              limit: 10000,
            },
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
          announcements: snapshot => {
            const announcements =
              snapshot && snapshot.docs
                ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                : [];
            const count = announcements.length;
            log.trace(`[TIEMPO REAL] Anuncios actualizados: ${count}`, CAT.ADMIN);

            this.updateStatsCache({
              products: count,
            });

            const productsElement = document.getElementById('productsCount');
            if (productsElement) {
              const startValue = parseInt(productsElement.textContent.replace(/,/g, '')) || 0;
              this.animateValue(productsElement, startValue, count, 1000);
            }
          },
        });

        log.info('Estadísticas en TIEMPO REAL inicializadas exitosamente', CAT.ADMIN);

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

      const { collection, getDocs, writeBatch, db } = window.firebaseModular || {};
      if (!getDocs || !writeBatch) {
        log.error('Firebase Modular no disponible para resetVisits', CAT.FIREBASE);
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
        window.NotificationSystem.show('Visitas restablecidas correctamente', 'success');
      }
      this.updateStatsCache({ visits: 0 });

      await this.initRealTimeStats({ force: true });
    } catch (error) {
      console.error('❌ Error al restablecer visitas:', error);

      let errorMsg = 'Error al restablecer visitas';
      if (error.code === 'permission-denied') {
        errorMsg = '❌ Error de Permisos: Verifica las reglas de Firestore en tu consola Firebase.';
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
        const announcementsSnapshot = await this.db.collection('announcements').get();
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
      link.download = `${safeName || 'export'}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      log.debug('Exportación de datos completada', CAT.ADMIN);
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

    if (this.realTimeInitialized) {
      await Promise.allSettled([this.refreshPaymentsStatus(), this.loadStats()]);
      return;
    }

    await this.initRealTimeStats({ force: true });
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
