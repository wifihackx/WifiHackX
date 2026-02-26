/**
 * Dashboard Charts Manager
 * Gestiona los gráficos del panel de administración (Dashboard)
 * @version 1.0.0
 */
'use strict';

function setupDashboardChartsManager() {
  const log = window.Logger;
  const CAT = {
    CHARTS: 'CHARTS',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  // Prevenir carga duplicada
  if (window.markScriptLoaded && !window.markScriptLoaded('dashboard-charts-manager.js')) {
    log.warn('dashboard-charts-manager.js ya fue cargado, saltando...', CAT.INIT);
    return;
  }

  class DashboardChartsManager {
    constructor() {
      this.charts = {
        users: null,
        sales: null,
      };
      this.initialized = false;
      this.dataUnsubscribe = null;
      this._initializing = false; // Bandera para prevenir inicialización simultánea
    }

    /**
     * Inicializa el gestor de gráficos del Dashboard
     */
    async init() {
      if (this.initialized) {
        log.debug('Dashboard Charts ya inicializado, re-renderizando', CAT.INIT);
        await this.loadAndRenderCharts();
        return;
      }

      // Prevenir inicialización simultánea múltiple
      if (this._initializing) {
        log.debug('Inicialización de Dashboard Charts ya en progreso', CAT.INIT);
        return;
      }

      this._initializing = true;
      log.info('Inicializando Dashboard Charts Manager...', CAT.INIT);

      try {
        const chartReady = await this.ensureChartJs();
        if (!chartReady) {
          log.error('No se pudo cargar Chart.js', CAT.INIT);
          this._initializing = false;
          return;
        }

        // Verificar dependencias
        if (!this.checkDependencies()) {
          this._initializing = false;
          return;
        }

        // Suscribirse a cambios de datos
        this.subscribeToDataChanges();

        // Cargar y renderizar datos iniciales
        await this.loadAndRenderCharts();

        // Marcar como inicializado solo cuando el DOM del dashboard tiene canvases.
        const hasUsersCanvas = !!document.getElementById('usersChart');
        const hasSalesCanvas = !!document.getElementById('salesChart');
        this.initialized = hasUsersCanvas || hasSalesCanvas;
        this._initializing = false;
        log.info('Dashboard Charts Manager inicializado', CAT.INIT);
      } catch (error) {
        this._initializing = false;
        log.error('Error inicializando Dashboard Charts', CAT.INIT, error);
      }
    }

    /**
     * Verifica que las dependencias necesarias estén disponibles
     * @returns {boolean} True si todas las dependencias están disponibles
     */
    checkDependencies() {
      if (typeof Chart === 'undefined') {
        log.error('Chart.js no está disponible', CAT.INIT);
        return false;
      }

      return true;
    }

    /**
     * Suscribe a cambios de datos para actualizar gráficos en tiempo real
     */
    subscribeToDataChanges() {
      // Opción 1: Suscribirse a AppState
      if (window.AppState && window.AppState.subscribe) {
        this.dataUnsubscribe = window.AppState.subscribe('admin.data', data => {
          if (data) {
            this.updateCharts(data);
          }
        });
      }

      // Opción 2: Escuchar evento personalizado
      window.addEventListener('adminDataUpdated', event => {
        if (event.detail && event.detail.data) {
          log.trace('Evento adminDataUpdated recibido', CAT.CHARTS);
          this.updateCharts(event.detail.data);
        }
      });
    }

    /**
     * Carga datos y renderiza los gráficos
     */
    async loadAndRenderCharts() {
      try {
        const data = await this.fetchChartData();
        await this.renderCharts(data);
      } catch (error) {
        log.error('Error cargando datos para gráficos', CAT.CHARTS, error);
      }
    }

    async fetchChartData() {
      try {
        const serverSnapshot = await this.fetchFromServerSnapshot(7);
        if (serverSnapshot) {
          return serverSnapshot;
        }

        const dataManager =
          (window.AdminDataManager && window.AdminDataManager.getInstance
            ? window.AdminDataManager.getInstance()
            : window.adminDataManager) || null;

        if (dataManager && typeof dataManager.getAllData === 'function') {
          const data = await dataManager.getAllData();
          return {
            users: data?.users || [],
            orders: data?.orders || [],
          };
        }

        log.warn('AdminDataManager no disponible, usando fallback Firestore', CAT.CHARTS);
        return this.fetchFromFirestoreFallback();
      } catch (error) {
        log.error('Error obteniendo datos desde AdminDataManager', CAT.CHARTS, error);
        return this.fetchFromFirestoreFallback();
      }
    }

    async fetchFromServerSnapshot(days = 7) {
      try {
        if (!window.firebase?.functions) return null;
        const callable = window.firebase.functions().httpsCallable('getAdminDashboardSnapshot');
        const result = await callable({ days });
        if (!result?.data?.success || !result?.data?.series) return null;
        return {
          users: [],
          orders: [],
          usersSeries: {
            labels: result.data.series.labels || [],
            values: result.data.series.users || [],
          },
          salesSeries: {
            labels: result.data.series.labels || [],
            values: result.data.series.sales || [],
          },
        };
      } catch (_error) {
        return null;
      }
    }

    async fetchFromFirestoreFallback() {
      try {
        if (!window.firebase || !window.firebase.firestore) {
          return { users: [], orders: [] };
        }

        const db = window.firebase.firestore();
        const [usersSnapshot, ordersSnapshot] = await Promise.all([
          db.collection('users').get(),
          db.collection('orders').get(),
        ]);

        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { users, orders };
      } catch (error) {
        log.error('Error en fallback Firestore para charts', CAT.CHARTS, error);
        return { users: [], orders: [] };
      }
    }

    async ensureChartJs() {
      if (typeof Chart !== 'undefined') return true;
      if (window.__CHART_JS_PROMISE__) return window.__CHART_JS_PROMISE__;

      window.__CHART_JS_PROMISE__ = new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      return window.__CHART_JS_PROMISE__;
    }

    /**
     * Renderiza todos los gráficos del Dashboard
     * @param {Object} data Datos para renderizar
     */
    async renderCharts(data) {
      if (!data) return;

      // Verificar que el Dashboard esté visible
      const dashboardSection = document.getElementById('dashboardSection');
      if (!dashboardSection) {
        log.warn('Dashboard section no encontrada', CAT.CHARTS);
        return;
      }

      // No verificar si está activo, solo verificar que exista
      // Los gráficos se pueden renderizar aunque el Dashboard no esté visible aún
      // Esto permite que se rendericen en la carga inicial

      // Delay para asegurar que el DOM esté listo
      await new Promise(resolve => setTimeout(resolve, 300));

      // Renderizar gráficos
      await this.renderUsersChart(data.users || [], data.usersSeries || null);
      await this.renderSalesChart(data.orders || [], data.salesSeries || null);
    }

    /**
     * Renderiza el gráfico de usuarios registrados
     * @param {Array} users Array de usuarios
     */
    async renderUsersChart(users, series = null) {
      const ctx = document.getElementById('usersChart');
      if (!ctx) {
        log.warn('Canvas usersChart no encontrado', CAT.CHARTS);
        return;
      }

      // Validar dimensiones del contenedor
      if (!(await this.validateContainer(ctx))) {
        return;
      }

      // Destruir gráfico anterior si existe
      if (this.charts.users) {
        this.charts.users.destroy();
      }

      // Procesar datos
      const chartData =
        series && Array.isArray(series.labels) && Array.isArray(series.values)
          ? series
          : this.processUsersData(users);

      // Crear gráfico
      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(112, 0, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(112, 0, 255, 0)');

      this.charts.users = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: 'Usuarios Registrados',
              data: chartData.values,
              borderColor: '#7000ff',
              borderWidth: 3,
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#7000ff',
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: this.getChartOptions(),
      });

      log.debug('usersChart renderizado', CAT.CHARTS);
    }

    /**
     * Renderiza el gráfico de ventas por día
     * @param {Array} orders Array de órdenes
     */
    async renderSalesChart(orders, series = null) {
      const ctx = document.getElementById('salesChart');
      if (!ctx) {
        log.warn('Canvas salesChart no encontrado', CAT.CHARTS);
        return;
      }

      // Validar dimensiones del contenedor
      if (!(await this.validateContainer(ctx))) {
        return;
      }

      // Destruir gráfico anterior si existe
      if (this.charts.sales) {
        this.charts.sales.destroy();
      }

      // Procesar datos
      const chartData =
        series && Array.isArray(series.labels) && Array.isArray(series.values)
          ? series
          : this.processSalesData(orders);

      // Crear gráfico
      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(0, 242, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 242, 255, 0)');

      this.charts.sales = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: 'Ventas (€)',
              data: chartData.values,
              borderColor: '#00f2ff',
              borderWidth: 3,
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#00f2ff',
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: this.getChartOptions(true),
      });

      log.debug('salesChart renderizado', CAT.CHARTS);
    }

    /**
     * Procesa datos de usuarios para el gráfico
     * @param {Array} users Array de usuarios
     * @returns {Object} Datos procesados para Chart.js
     */
    processUsersData(users) {
      // Agrupar usuarios por fecha
      const usersByDate = {};
      users.forEach(user => {
        const date = this.getEntityDate(user, 'createdAt');
        if (!date) return;
        const dateStr = date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });
        usersByDate[dateStr] = (usersByDate[dateStr] || 0) + 1;
      });

      // Obtener últimos 7 días
      const last7Days = this.getLast7Days();
      const values = last7Days.map(day => usersByDate[day] || 0);

      return {
        labels: last7Days,
        values: values,
      };
    }

    /**
     * Procesa datos de ventas para el gráfico
     * @param {Array} orders Array de órdenes
     * @returns {Object} Datos procesados para Chart.js
     */
    processSalesData(orders) {
      // Agrupar ventas por fecha
      const salesByDate = {};
      orders.forEach(order => {
        if (!this.isSuccessfulOrderStatus(order?.status)) return;
        const date = this.getEntityDate(order, 'createdAt');
        if (!date) return;
        const dateStr = date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });
        const amount = this.getOrderAmount(order);
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + amount;
      });

      // Obtener últimos 7 días
      const last7Days = this.getLast7Days();
      const values = last7Days.map(day => salesByDate[day] || 0);

      return {
        labels: last7Days,
        values: values,
      };
    }

    /**
     * Obtiene los últimos 7 días en formato DD/MM
     * @returns {Array<string>} Array de fechas
     */
    getLast7Days() {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(
          date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
          })
        );
      }
      return days;
    }

    /**
     * Obtiene una fecha válida desde un objeto (user/order)
     * @param {Object} entity
     * @param {string} preferredField
     * @returns {Date|null}
     */
    getEntityDate(entity, preferredField = 'createdAt') {
      if (!entity) return null;
      let value = entity[preferredField];
      if (!value && preferredField === 'createdAt') {
        value =
          entity.timestamp ||
          entity.created_at ||
          entity.created ||
          entity.purchasedAt ||
          entity.paidAt ||
          entity.paymentDate ||
          entity.completedAt;
      }
      if (!value) return null;
      if (value.toDate) return value.toDate();
      if (value.seconds) return new Date(value.seconds * 1000);
      if (typeof value === 'number') return new Date(value);
      return new Date(value);
    }

    /**
     * Obtiene el valor monetario de una orden
     * @param {Object} order
     * @returns {number}
     */
    getOrderAmount(order) {
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
        if (order[candidate.key] === undefined || order[candidate.key] === null) continue;
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
    }

    isSuccessfulOrderStatus(status) {
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
    }

    /**
     * Valida que el contenedor del canvas tenga dimensiones válidas
     * @param {HTMLCanvasElement} ctx Canvas element
     * @param {number} retryCount Número de reintentos
     * @returns {Promise<boolean>} True si el contenedor es válido
     */
    async validateContainer(ctx, retryCount = 0) {
      if (!ctx) return false;

      const container = ctx.parentElement;
      if (!container) {
        log.warn(`No parent container for ${ctx.id}`, CAT.CHARTS);
        return false;
      }

      const rect = container.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) {
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 200));
          return this.validateContainer(ctx, retryCount + 1);
        }
        log.warn(`Container for ${ctx.id} has no size after retries`, CAT.CHARTS);
        return false;
      }

      return true;
    }

    /**
     * Obtiene opciones de configuración para Chart.js
     * @param {boolean} isCurrency Si el gráfico muestra valores monetarios
     * @returns {Object} Opciones de Chart.js
     */
    getChartOptions(isCurrency = false) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(10, 10, 20, 0.9)',
            titleColor: '#00f2ff',
            bodyColor: '#fff',
            borderColor: 'rgba(0, 242, 255, 0.2)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  if (isCurrency) {
                    label += '€' + context.parsed.y.toFixed(2);
                  } else {
                    label += Math.round(context.parsed.y).toLocaleString('es-ES');
                  }
                }
                return label;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.03)',
              drawBorder: false,
            },
            ticks: {
              color: '#64748b',
              font: {
                family: "'Inter', sans-serif",
                size: 11,
              },
              padding: 10,
              callback: function (value) {
                if (isCurrency) {
                  return '€' + value.toFixed(0);
                }
                return value;
              },
            },
            border: {
              display: false,
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#64748b',
              font: {
                family: "'Inter', sans-serif",
                size: 11,
              },
              padding: 10,
            },
            border: {
              display: false,
            },
          },
        },
      };
    }

    /**
     * Actualiza los gráficos con nuevos datos
     * @param {Object} data Nuevos datos
     */
    updateCharts(data) {
      if (!this.initialized) return;
      this.renderCharts(data);
    }

    /**
     * Limpia recursos y listeners
     */
    cleanup() {
      if (this.charts.users) {
        this.charts.users.destroy();
        this.charts.users = null;
      }
      if (this.charts.sales) {
        this.charts.sales.destroy();
        this.charts.sales = null;
      }
      if (this.dataUnsubscribe) {
        this.dataUnsubscribe();
        this.dataUnsubscribe = null;
      }
      this.initialized = false;
      log.info('Dashboard Charts Manager limpiado', CAT.INIT);
    }
  }

  // Crear instancia global
  window.DashboardChartsManager = DashboardChartsManager;
  window.dashboardChartsManager = new DashboardChartsManager();

  // Auto-inicializar cuando el Dashboard se active
  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-action="showAdminSection"]');
    if (tabBtn) {
      const section = tabBtn.dataset.params || tabBtn.getAttribute('data-params');
      if (section === 'dashboard') {
        setTimeout(() => {
          window.dashboardChartsManager.init();
        }, 500);
      }
    }
  });

  // También inicializar cuando el Dashboard ya esté visible al cargar
  // Esto maneja el caso donde el usuario refresca la página estando en el Dashboard
  window.addEventListener('load', () => {
    setTimeout(() => {
      const dashboardSection = document.getElementById('dashboardSection');
      if (dashboardSection && dashboardSection.classList.contains('active')) {
        log.info('Dashboard activo al cargar, inicializando charts...', CAT.INIT);
        window.dashboardChartsManager.init();
      }
    }, 1000); // Esperar 1 segundo para que todo se cargue
  });

  // Observar cambios en la clase 'active' del Dashboard
  // Esto maneja el caso donde el Dashboard se activa después de la carga
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.id === 'dashboardSection' && target.classList.contains('active')) {
          log.info('Dashboard activado, re-inicializando charts...', CAT.INIT);
          setTimeout(() => {
            window.dashboardChartsManager.init();
          }, 300);
        }
      }
    });
  });

  // Observar el Dashboard section cuando esté disponible
  const startObserving = () => {
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) {
      observer.observe(dashboardSection, {
        attributes: true,
        attributeFilter: ['class'],
      });
      log.debug('Observer instalado en dashboardSection', CAT.INIT);

      // Si el dashboard ya llegó activo cuando se monta el observer,
      // forzar init (no habrá mutación de clase que dispare el observer).
      if (dashboardSection.classList.contains('active')) {
        setTimeout(() => {
          window.dashboardChartsManager.init();
        }, 150);
      }
    } else {
      // Si no existe aún, intentar de nuevo en 500ms
      setTimeout(startObserving, 500);
    }
  };

  // Iniciar observación
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }

  log.info('Dashboard Charts Manager module loaded', CAT.INIT);
}

export function initDashboardChartsManager() {
  if (window.__DASHBOARD_CHARTS_MANAGER_INITED__) {
    return;
  }

  window.__DASHBOARD_CHARTS_MANAGER_INITED__ = true;
  setupDashboardChartsManager();
}

if (typeof window !== 'undefined' && !window.__DASHBOARD_CHARTS_MANAGER_NO_AUTO__) {
  initDashboardChartsManager();
}
