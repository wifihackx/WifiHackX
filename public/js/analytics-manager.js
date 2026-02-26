const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

/**
 * AnalyticsManager - Gestión de métricas y exportación de reportes
 * Compatible con WifiHackX V3.0
 */
if (!window.AnalyticsManager) {
  window.AnalyticsManager = class AnalyticsManager {
    static log(level, message, data) {
      if (level === 'debug' && data === false) {
        return;
      }
      if (window.Logger && typeof window.Logger[level] === 'function') {
        window.Logger[level](message, 'ANALYTICS', data === false ? undefined : data);
        return;
      }
      if (level === 'error') {
        console.error(message, data || '');
      } else if (level === 'warn') {
        console.warn(message, data || '');
      } else {
        debugLog(message);
      }
    }
    constructor() {
      this.dateFilter = {
        days: 30,
        startDate: null,
        endDate: null,
      };
      this.charts = {
        sales: null,
        users: null,
        traffic: null,
        devices: null,
      };
      this.realTimeUnsubscribe = null;
      this.lastUpdateTime = 0;
      this.debounceTimer = null;
      this.cachedData = null; // Cachear datos para renderizar cuando se active la sección
      this.debug = false;
      this._chartsRetryTimer = null;
      this._chartsRetryCount = 0;
      this._analyticsSectionObserver = null;
      this.init();
    }

    init() {
      AnalyticsManager.log('debug', 'AnalyticsManager inicializado', this.debug);
      this.setupEventListeners();
      this.setupAnalyticsSectionObserver();
      this.initRealTimeUpdates();

      // Auto-refresh al iniciar (con breve delay para asegurar carga del DOM)
      setTimeout(() => this.refreshData(), 500);
    }

    setupAnalyticsSectionObserver() {
      const bindObserver = () => {
        const analyticsSection = document.getElementById('analyticsSection');
        if (!analyticsSection) return false;

        if (this._analyticsSectionObserver) {
          this._analyticsSectionObserver.disconnect();
          this._analyticsSectionObserver = null;
        }

        this._analyticsSectionObserver = new MutationObserver(() => {
          if (analyticsSection.classList.contains('active')) {
            if (this.cachedData) {
              this.renderCharts(this.cachedData);
            } else {
              this.refreshData();
            }
          }
        });

        this._analyticsSectionObserver.observe(analyticsSection, {
          attributes: true,
          attributeFilter: ['class'],
        });
        return true;
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindObserver, {
          once: true,
        });
      } else {
        bindObserver();
      }
    }

    // ==========================================================================
    // ACTUALIZACIONES EN TIEMPO REAL
    // ==========================================================================

    /**
     * Inicializa actualizaciones en tiempo real usando RealTimeDataService
     * Reemplaza refreshData() manual con suscripciones automáticas
     */
    async initRealTimeUpdates() {
      try {
        AnalyticsManager.log(
          'debug',
          'Inicializando actualizaciones en tiempo real para Analytics...',
          this.debug
        );

        // Verificar que RealTimeDataService esté disponible
        if (!window.realTimeDataService) {
          AnalyticsManager.log('warn', 'RealTimeDataService no disponible, usando datos estáticos');
          await this.refreshData();
          return;
        }

        // Esperar a que RealTimeDataService esté inicializado
        await window.realTimeDataService.init();

        // Suscribir a colecciones relevantes con debounce
        AnalyticsManager.log(
          'debug',
          'Suscribiendo a colecciones de analytics en tiempo real...',
          this.debug
        );

        this.realTimeUnsubscribe = window.realTimeDataService.subscribeToMultiple({
          orders: snapshot => {
            // Procesar snapshot a array
            const orders =
              snapshot && snapshot.docs
                ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                : [];
            this.onOrdersUpdated(orders);
          },
          analytics_visits: snapshot => {
            // Procesar snapshot a array
            const visits =
              snapshot && snapshot.docs
                ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                : [];
            this.onVisitsUpdated(visits);
          },
          // users: removido - el contador ahora usa Firebase Auth directamente
        });

        AnalyticsManager.log(
          'debug',
          'Actualizaciones en tiempo real inicializadas para Analytics',
          this.debug
        );
      } catch (error) {
        AnalyticsManager.log('error', 'Error inicializando actualizaciones en tiempo real', error);
        await this.refreshData(); // Fallback a datos estáticos
      }
    }

    /**
     * Callback cuando se actualizan los pedidos (debounced)
     */
    onOrdersUpdated(_orders) {
      // Cancelar debounce anterior
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Debounce para evitar flickering en gráficos (1 segundo)
      this.debounceTimer = setTimeout(async () => {
        try {
          const data = await this.fetchData();
          const metrics = this.calculateCurrentMetrics(data);
          this.updateMetricsUI(metrics);
          this.renderCharts(data);
          AnalyticsManager.log(
            'debug',
            'Gráficos actualizados por cambio en pedidos (tiempo real)',
            this.debug
          );
        } catch (error) {
          AnalyticsManager.log('error', 'Error actualizando gráficos', error);
        }
      }, 1000);
    }

    /**
     * Callback cuando se actualizan las visitas (debounced)
     */
    onVisitsUpdated(_visits) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        try {
          const data = await this.fetchData();
          const metrics = this.calculateCurrentMetrics(data);
          this.updateMetricsUI(metrics);
          this.renderCharts(data);
          AnalyticsManager.log(
            'debug',
            'Gráficos actualizados por cambio en visitas (tiempo real)',
            this.debug
          );
        } catch (error) {
          AnalyticsManager.log('error', 'Error actualizando gráficos', error);
        }
      }, 1000);
    }

    /**
     * @deprecated - El contador de usuarios ahora usa Firebase Auth directamente
     * Callback cuando se actualizan los usuarios (debounced)
     */
    // onUsersUpdated(_users) {
    //   if (this.debounceTimer) {
    //     clearTimeout(this.debounceTimer);
    //   }

    //   this.debounceTimer = setTimeout(async () => {
    //     try {
    //       const data = await this.fetchData();
    //       const metrics = this.calculateCurrentMetrics(data);
    //       this.updateMetricsUI(metrics);
    //       this.renderCharts(data);
    //       debugLog(
    //         '📊 [TIEMPO REAL] Gráficos actualizados por cambio en usuarios'
    //       );
    //     } catch (error) {
    //       console.error('❌ Error actualizando gráficos:', error);
    //     }
    //   }, 1000);
    // }

    /**
     * Limpia suscripciones en tiempo real
     */
    cleanupRealTimeUpdates() {
      if (this.realTimeUnsubscribe) {
        this.realTimeUnsubscribe();
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      AnalyticsManager.log('debug', 'Suscripciones en tiempo real limpiadas', this.debug);
    }

    // ==========================================================================
    // CONFIGURACIÓN DE EVENTOS
    // ==========================================================================

    setupEventListeners() {
      // Un solo delegado global para acciones de Analytics.
      document.addEventListener('click', e => {
        const exportBtn = e.target.closest('[data-action="exportAnalytics"]');
        if (exportBtn) {
          this.exportToCSV();
          return;
        }

        const tabBtn = e.target.closest('[data-action="showAdminSection"]');
        if (tabBtn) {
          const section = tabBtn.dataset.params || tabBtn.getAttribute('data-params');
          if (section === 'analytics') {
            // Pequeño delay para que la sección sea visible y tenga dimensiones
            setTimeout(() => {
              AnalyticsManager.log(
                'debug',
                'Refrescando gráficos (entrada en pestaña Analytics)',
                this.debug
              );
              // Si hay datos en caché, renderizarlos inmediatamente
              if (this.cachedData) {
                AnalyticsManager.log('debug', 'Renderizando gráficos desde caché', this.debug);
                this.renderCharts(this.cachedData);
              } else {
                this.refreshData();
              }
            }, 400);
          }
        }
      });

      // Manejo de filtros de fecha
      const applyBtn = document.getElementById('applyFilters');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => this.refreshData());
      }
    }

    // ==========================================================================
    // CONTROL DE DATOS Y UI
    // ==========================================================================

    async refreshData() {
      AnalyticsManager.log('debug', 'Refrescando dashboard de analytics...', this.debug);
      try {
        const data = await this.fetchData();
        const metrics = this.calculateCurrentMetrics(data);
        this.updateMetricsUI(metrics);
        this.renderCharts(data);
      } catch (error) {
        AnalyticsManager.log('error', 'Error refrescando datos', error);
      }
    }

    updateMetricsUI(metrics) {
      const updateElement = (id, text, changeId, changeVal) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;

        const changeEl = document.getElementById(changeId);
        if (changeEl && changeVal !== undefined) {
          changeEl.textContent = (changeVal >= 0 ? '+' : '') + changeVal + '%';
          changeEl.className = 'metric-change ' + (changeVal >= 0 ? 'positive' : 'negative');
        }
      };

      // Actualizar cartas
      updateElement('revenue', metrics.revenue.value, 'revenueChange', metrics.revenue.change);
      updateElement(
        'activeUsers',
        metrics.activeUsers.value,
        'activeUsersChange',
        metrics.activeUsers.change
      );
      updateElement(
        'conversionRate',
        metrics.conversionRate.value,
        'conversionChange',
        metrics.conversionRate.change
      );
      updateElement('avgTime', metrics.avgTime.value, 'avgTimeChange', metrics.avgTime.change); // avgTime change es string/num? asumimos num para color
      updateElement(
        'pagesPerSession',
        metrics.pagesPerSession.value,
        'pagesChange',
        metrics.pagesPerSession.change
      );
      updateElement(
        'bounceRate',
        metrics.bounceRate.value,
        'bounceRateChange',
        metrics.bounceRate.change
      );
    }

    // ==========================================================================
    // GENERAR TEXTO CSV
    // ==========================================================================
    generateCSV(data, metrics) {
      let csv = '\uFEFF'; // BOM para que Excel lea correctamente tildes y símbolos (€)

      // Sección 1: Cabecera y Métricas
      csv += 'REPORTE DE ANALYTICS - WIFIHACKX\n';
      csv += `Fecha del reporte,${new Date().toLocaleString()}\n\n`;

      csv += 'MÉTRICAS PRINCIPALES\n';
      csv += 'Métrica,Valor,Tendencia\n';
      csv += `Ingresos Total,${metrics.revenue.value.replace('€', '').trim()},${metrics.revenue.change}%\n`;
      csv += `Usuarios Activos,${metrics.activeUsers.value},${metrics.activeUsers.change}%\n\n`;

      // Sección 2: Detalle de Pedidos
      csv += 'DETALLE DE OPERACIONES\n';
      csv += 'ID Pedido,Fecha,Cliente,Total,Estado\n';

      if (data.orders && data.orders.length > 0) {
        data.orders.forEach(order => {
          // Lógica de fecha segura para evitar errores de sintaxis
          let orderDate;
          if (order.createdAt && typeof order.createdAt.toDate === 'function') {
            orderDate = order.createdAt.toDate();
          } else {
            orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
          }

          const id = order.id || 'N/A';
          const dateStr = orderDate.toLocaleDateString();
          const customer = (order.customerName || 'Anónimo').replace(/,/g, ''); // Evitar romper columnas CSV
          const total = parseFloat(order.price) || 0;
          const status = order.status || 'Completado';

          csv += `${id},${dateStr},"${customer}",${total},${status}\n`;
        });
      } else {
        csv += 'No hay pedidos en este periodo,,,\n';
      }

      return csv;
    }

    // ==========================================================================
    // DISPARAR DESCARGA
    // ==========================================================================
    async exportToCSV() {
      try {
        if (window.NotificationSystem) {
          window.NotificationSystem.show('Preparando reporte...', 'info');
        }

        // Simulamos u obtenemos los datos (Asegúrate de que AdminDataManager exista)
        const data = await this.fetchData();
        const metrics = this.calculateCurrentMetrics(data);

        const csvContent = this.generateCSV(data, metrics);
        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];

        link.setAttribute('href', url);
        link.setAttribute('download', `wifi-hackx-report-${date}.csv`);
        if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
          window.DOMUtils.setDisplay(link, 'none');
        } else {
          link.classList.add('hidden');
        }

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.NotificationSystem) {
          window.NotificationSystem.show('Reporte descargado con éxito', 'success');
        }
      } catch (error) {
        AnalyticsManager.log('error', 'Error al exportar', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.show('Error al generar el CSV', 'error');
        }
      }
    }

    // ==========================================================================
    // RENDERIZADO DE GRÁFICOS (Chart.js)
    // ==========================================================================

    async renderCharts(data) {
      if (!data) return;

      // Guardar datos en caché para renderizar más tarde si es necesario
      this.cachedData = data;

      // Esperar a que la sección sea visible (si estamos en la pestaña analytics)
      const analyticsSection = document.getElementById('analyticsSection');
      if (analyticsSection && !analyticsSection.classList.contains('active')) {
        AnalyticsManager.log(
          'debug',
          'Analytics section not active, datos guardados en caché',
          this.debug
        );
        this.scheduleRenderWhenVisible(analyticsSection);
        return;
      }

      const trendsCanvas = document.getElementById('trendsChart');
      const trafficCanvas = document.getElementById('trafficChart');
      const devicesCanvas = document.getElementById('devicesChart');
      const hasCanvas = trendsCanvas || trafficCanvas || devicesCanvas;
      if (!hasCanvas) {
        this.scheduleChartsRetry(data);
        return;
      }

      // Asegurar Chart.js disponible (fallback lazy load)
      const chartReady = await this.ensureChartJs();
      if (!chartReady) {
        AnalyticsManager.log('warn', 'Chart.js no disponible para Analytics');
        return;
      }

      // Aumentar delay de 100ms a 500ms para dar más tiempo al layout
      await new Promise(resolve => setTimeout(resolve, 500));

      // 1. Gráfico de Ventas (Line) - EN ANALYTICS
      if (data.trends) {
        await this.initSalesChart(data.trends);
      }

      // 2. Gráfico de Usuarios Registrados (Line) - ❌ REMOVIDO: Este gráfico está en Dashboard, no en Analytics
      // if (data.userTrends) {
      //   await this.initUsersChart(data.userTrends);
      // }

      // 3. Gráfico de Distribución de Tráfico (Doughnut) - EN ANALYTICS
      if (data.traffic) {
        await this.initTrafficChart(data.traffic);
      }

      // 4. Gráfico de Dispositivos (Pie) - EN ANALYTICS
      if (data.devices) {
        await this.initDevicesChart(data.devices);
      }

      this._chartsRetryCount = 0;
      if (this._chartsRetryTimer) {
        clearTimeout(this._chartsRetryTimer);
        this._chartsRetryTimer = null;
      }
    }

    scheduleChartsRetry(data) {
      if (this._chartsRetryCount >= 8) return;
      if (this._chartsRetryTimer) return;
      this._chartsRetryCount += 1;
      this._chartsRetryTimer = setTimeout(() => {
        this._chartsRetryTimer = null;
        this.renderCharts(data);
      }, 250);
    }

    scheduleRenderWhenVisible(analyticsSection) {
      if (!analyticsSection) return;
      if (this._visibilityObserver) return;

      const triggerRender = () => {
        if (analyticsSection.classList.contains('active')) {
          if (this._visibilityObserver) {
            this._visibilityObserver.disconnect();
            this._visibilityObserver = null;
          }
          // Defer to allow layout to settle
          setTimeout(() => {
            if (this.cachedData) {
              this.renderCharts(this.cachedData);
            }
          }, 0);
        }
      };

      this._visibilityObserver = new MutationObserver(triggerRender);
      this._visibilityObserver.observe(analyticsSection, {
        attributes: true,
        attributeFilter: ['class'],
      });

      // Check immediately in case it became active before observer
      triggerRender();
    }

    async checkContainer(ctx, retryCount = 0) {
      if (!ctx) {
        AnalyticsManager.log('warn', 'Canvas context is null');
        return false;
      }

      const container = ctx.parentElement;
      if (!container) {
        AnalyticsManager.log('warn', `No parent container for ${ctx.id}`);
        return false;
      }

      // Si el contenedor no tiene altura, algo anda mal (probablemente oculto)
      const rect = container.getBoundingClientRect();
      const canvasRect = ctx.getBoundingClientRect();

      AnalyticsManager.log(
        'debug',
        `${ctx.id} - Container: ${rect.width}x${rect.height}, Canvas: ${canvasRect.width}x${canvasRect.height}, Retry: ${retryCount}`,
        this.debug
      );

      if (rect.height === 0 || rect.width === 0) {
        if (retryCount < 5) {
          // Reintentar en 200ms
          await new Promise(resolve => setTimeout(resolve, 200));
          return this.checkContainer(ctx, retryCount + 1);
        }
        AnalyticsManager.log(
          'warn',
          `Container for ${ctx.id} has no size after retries. Container: ${rect.width}x${rect.height}`
        );
        return false;
      }

      // Verificar también que el canvas tenga dimensiones
      if (canvasRect.height === 0 || canvasRect.width === 0) {
        AnalyticsManager.log(
          'warn',
          `Canvas ${ctx.id} has no size. Canvas: ${canvasRect.width}x${canvasRect.height}`
        );
        // Intentar forzar dimensiones desde atributos HTML
        if (ctx.width && ctx.height) {
          AnalyticsManager.log(
            'debug',
            `Canvas ${ctx.id} has width/height attributes: ${ctx.width}x${ctx.height}`,
            this.debug
          );
        }
      }

      return true;
    }

    async initSalesChart(trendData) {
      const ctx = document.getElementById('trendsChart');
      if (!ctx || !(await this.checkContainer(ctx))) return;
      if (!(await this.ensureChartJs())) return;

      if (this.charts.sales) this.charts.sales.destroy();

      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(0, 242, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 242, 255, 0)');

      this.charts.sales = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.labels,
          datasets: [
            {
              label: 'Ventas (€)',
              data: trendData.values,
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
        options: this.getChartOptions(),
      });
    }

    async initUsersChart(userTrendData) {
      const ctx = document.getElementById('usersChart');
      if (!ctx || !(await this.checkContainer(ctx))) return;
      if (!(await this.ensureChartJs())) return;

      if (this.charts.users) this.charts.users.destroy();

      const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(112, 0, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(112, 0, 255, 0)');

      this.charts.users = new Chart(ctx, {
        type: 'line',
        data: {
          labels: userTrendData.labels,
          datasets: [
            {
              label: 'Usuarios Registrados',
              data: userTrendData.values,
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
    }

    async initTrafficChart(trafficData) {
      const ctx = document.getElementById('trafficChart');
      if (!ctx || !(await this.checkContainer(ctx))) return;
      if (!(await this.ensureChartJs())) return;

      if (this.charts.traffic) this.charts.traffic.destroy();

      this.charts.traffic = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: trafficData.labels,
          datasets: [
            {
              label: 'Visitas',
              data: trafficData.values,
              backgroundColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderWidth: 1,
              borderRadius: 8,
            },
          ],
        },
        options: this.getHorizontalBarOptions(),
      });
    }

    async initDevicesChart(deviceData) {
      const ctx = document.getElementById('devicesChart');
      if (!ctx || !(await this.checkContainer(ctx))) return;
      if (!(await this.ensureChartJs())) return;

      if (this.charts.devices) this.charts.devices.destroy();

      this.charts.devices = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: deviceData.labels,
          datasets: [
            {
              label: 'Sesiones',
              data: deviceData.values,
              backgroundColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderWidth: 1,
              borderRadius: 8,
            },
          ],
        },
        options: this.getHorizontalBarOptions(),
      });
    }

    getHorizontalBarOptions() {
      const base = this.getChartOptions();
      return {
        ...base,
        indexAxis: 'y',
        plugins: {
          ...base.plugins,
          legend: {
            display: false,
          },
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: {
              label: context => {
                const label = context.label || '';
                const raw = Number(context.raw || 0);
                return `${label}: ${new Intl.NumberFormat('es-ES').format(raw)}`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false,
            },
            ticks: {
              color: '#64748b',
              font: {
                family: "'Inter', sans-serif",
                size: 11,
              },
            },
            border: {
              display: false,
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#cbd5e1',
              font: {
                family: "'Inter', sans-serif",
                size: 12,
              },
            },
            border: {
              display: false,
            },
          },
        },
      };
    }

    getChartOptions() {
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
                  label += new Intl.NumberFormat('es-ES').format(context.parsed.y);
                  if (context.dataset.label && context.dataset.label.includes('€')) {
                    label += ' €';
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

    async ensureChartJs() {
      if (typeof Chart !== 'undefined') return true;

      if (window.__CHART_JS_PROMISE__) {
        return window.__CHART_JS_PROMISE__;
      }

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

    // ==========================================================================
    // UTILIDADES
    // ==========================================================================

    /**
     * Genera array con las últimas N fechas
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
     * Agrupa datos por fecha
     */
    groupByDate(items, dateField, valueField = null) {
      const grouped = {};
      items.forEach(item => {
        const date = this.resolveDate(item, dateField);
        if (!date) return;
        const dateLabel = date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        });

        if (valueField) {
          const value = this.resolveValue(item, valueField);
          grouped[dateLabel] = (grouped[dateLabel] || 0) + value;
        } else {
          grouped[dateLabel] = (grouped[dateLabel] || 0) + 1;
        }
      });
      return grouped;
    }

    resolveDate(item, dateField) {
      if (!item) return null;
      let dateValue = item[dateField];
      if (!dateValue && dateField === 'createdAt') {
        dateValue =
          item.timestamp ||
          item.created_at ||
          item.created ||
          item.purchasedAt ||
          item.paidAt ||
          item.paymentDate ||
          item.completedAt;
      }
      if (!dateValue) return null;
      if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      if (dateValue && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
      }
      if (typeof dateValue === 'number') {
        return new Date(dateValue);
      }
      return new Date(dateValue);
    }

    resolveValue(item, valueField) {
      if (!item || !valueField) return 0;
      if (valueField === 'price') {
        return this.getOrderAmount(item);
      }
      let raw = item[valueField];
      if (raw === undefined || raw === null) return 0;
      if (typeof raw === 'string') {
        raw = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
      }
      const value = parseFloat(raw);
      return Number.isFinite(value) ? value : 0;
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

    getTimestampMs(value) {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      if (value?.toDate) return value.toDate().getTime();
      if (value?.seconds) return Number(value.seconds) * 1000;
      const parsed = Date.parse(String(value));
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    getCurrentSessionVisitFallback() {
      const ua = String(navigator.userAgent || '').toLowerCase();
      let device = 'Escritorio';
      if (/tablet|ipad/.test(ua)) {
        device = 'Tablet';
      } else if (/mobi|android|iphone|ipod/.test(ua)) {
        device = 'Móvil';
      }
      const source = document.referrer ? 'Referidos' : 'Directo';
      return {
        source,
        device,
        __ephemeral: true,
      };
    }

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

    // ==========================================================================
    // MÉTODOS AUXILIARES DE CARGA DE DATOS
    // ==========================================================================

    async fetchData() {
      const emptyResult = {
        orders: [],
        visits: [],
        users: [],
        trends: {
          labels: [],
          values: [],
        },
      };

      let data = null;
      const dataManager =
        window.adminDataManager ||
        (window.AdminDataManager && typeof window.AdminDataManager.getInstance === 'function'
          ? window.AdminDataManager.getInstance()
          : null);

      if (dataManager && typeof dataManager.getAllData === 'function') {
        data = await dataManager.getAllData();
      } else {
        AnalyticsManager.log('warn', 'AdminDataManager no disponible, usando fallback Firestore');
        data = await this.fetchDataFallbackFromFirestore();
      }

      if (!data) {
        return emptyResult;
      }
      const orders = data.orders || [];
      const rawVisits = data.visits || [];
      const users = data.users || [];
      const currentHost = String(window.location.hostname || '').toLowerCase();
      const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1';
      const hostMatchedVisits = rawVisits.filter(visit => {
        if (!visit || visit.isAdmin === true) return false;
        const visitHost = String(visit.siteHost || '')
          .toLowerCase()
          .trim();
        if (visitHost) {
          return visitHost === currentHost;
        }
        // Legacy docs sin siteHost: en producción se aceptan.
        return !isLocalHost;
      });
      // Modo estricto en localhost: evitar mezclar tráfico histórico de otros hosts.
      let visits = hostMatchedVisits;
      if (isLocalHost && visits.length === 0) {
        const now = Date.now();
        const twoHoursMs = 2 * 60 * 60 * 1000;
        // Fallback controlado: solo docs legacy sin siteHost y recientes.
        visits = rawVisits.filter(visit => {
          if (!visit || visit.isAdmin === true) return false;
          const host = String(visit.siteHost || '').trim();
          if (host) return false;
          const ts = this.getTimestampMs(visit.timestamp || visit.createdAt);
          return ts > 0 && now - ts <= twoHoursMs;
        });
        if (visits.length === 0) {
          // Último fallback en local: representar la sesión actual para que
          // Tráfico/Dispositivos no queden vacíos visualmente.
          visits = [this.getCurrentSessionVisitFallback()];
        }
      }

      const successfulOrders = orders.filter(order => this.isSuccessfulOrderStatus(order?.status));

      // Agrupar ventas por día usando la utilidad
      const salesByDate = this.groupByDate(successfulOrders, 'createdAt', 'price');

      // Agrupar usuarios por día de registro
      const usersByDate = this.groupByDate(users, 'createdAt');

      // Procesar tráfico real
      const trafficStats = {
        Directo: 0,
        Social: 0,
        Referidos: 0,
      };
      visits.forEach(v => {
        const source = v.source || 'Directo';
        if (trafficStats[source] !== undefined) trafficStats[source]++;
        else trafficStats['Referidos']++;
      });

      // Procesar dispositivos reales
      const deviceStats = {
        Móvil: 0,
        Escritorio: 0,
        Tablet: 0,
      };
      visits.forEach(v => {
        const device = v.device || 'Escritorio';
        if (deviceStats[device] !== undefined) deviceStats[device]++;
      });

      const hasSales = Object.keys(salesByDate).length > 0;
      const hasUsers = Object.keys(usersByDate).length > 0;
      const hasVisits = visits.length > 0;

      // Obtener últimas 7 fechas reales
      const last7Days = this.getLast7Days();

      // Función helper para rellenar datos faltantes
      const fillMissingDays = dataByDate => {
        return last7Days.map(day => dataByDate[day] || 0);
      };

      const result = {
        ...data,
        orders,
        visits,
        users,
        trends: {
          labels: hasSales ? Object.keys(salesByDate).slice(-7) : last7Days,
          values: hasSales ? Object.values(salesByDate).slice(-7) : fillMissingDays(salesByDate),
        },
        userTrends: {
          labels: hasUsers ? Object.keys(usersByDate).slice(-7) : last7Days,
          values: hasUsers ? Object.values(usersByDate).slice(-7) : fillMissingDays(usersByDate),
        },
        traffic: {
          labels: hasVisits
            ? Object.keys(trafficStats).filter(key => trafficStats[key] > 0)
            : ['Directo', 'Social', 'Referidos'],
          values: hasVisits ? Object.values(trafficStats).filter(val => val > 0) : [0, 0, 0],
        },
        devices: {
          labels: hasVisits
            ? Object.keys(deviceStats).filter(key => deviceStats[key] > 0)
            : ['Escritorio', 'Móvil', 'Tablet'],
          values: hasVisits ? Object.values(deviceStats).filter(val => val > 0) : [0, 0, 0],
        },
      };

      return result;
    }

    async fetchDataFallbackFromFirestore() {
      try {
        if (!window.firebase || !window.firebase.firestore) return null;
        const db = window.firebase.firestore();

        const [ordersSnapshot, visitsSnapshot, usersSnapshot] = await Promise.all([
          db.collection('orders').get(),
          db.collection('analytics_visits').get(),
          db.collection('users').get(),
        ]);

        return {
          orders: ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          visits: visitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          users: usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        };
      } catch (error) {
        AnalyticsManager.log(
          'error',
          'Error obteniendo datos de analytics desde Firestore fallback',
          error
        );
        return null;
      }
    }

    calculateCurrentMetrics(data) {
      const orders = data.orders || [];
      const visits = data.visits || [];
      const users = data.users || [];

      // Calcular período actual (últimos 7 días)
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Filtrar datos por período usando resolución robusta de fecha
      const filterByPeriod = (items, startDate, endDate, preferredField = 'createdAt') => {
        return items.filter(item => {
          const itemDate =
            this.resolveDate(item, preferredField) ||
            this.resolveDate(item, 'timestamp') ||
            this.resolveDate(item, 'createdAt');
          if (!itemDate || Number.isNaN(itemDate.getTime())) {
            return false;
          }
          return itemDate >= startDate && itemDate < endDate;
        });
      };

      // Datos del período actual
      const currentOrders = filterByPeriod(orders, last7Days, now);
      const currentUsers = filterByPeriod(users, last7Days, now);
      const currentVisits = filterByPeriod(visits, last7Days, now, 'timestamp');

      // Datos del período anterior
      const previousOrders = filterByPeriod(orders, previous7Days, last7Days);
      const previousUsers = filterByPeriod(users, previous7Days, last7Days);
      const previousVisits = filterByPeriod(visits, previous7Days, last7Days, 'timestamp');

      // Calcular ingresos
      const currentRevenue = currentOrders.reduce(
        (sum, order) => sum + (parseFloat(order.price) || 0),
        0
      );
      const previousRevenue = previousOrders.reduce(
        (sum, order) => sum + (parseFloat(order.price) || 0),
        0
      );

      // Calcular cambios porcentuales
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const getSessionAnalytics = periodVisits => {
        const sessions = new Map();

        periodVisits.forEach((visit, index) => {
          const sessionId =
            (typeof visit.sessionId === 'string' && visit.sessionId.trim()) ||
            `__no_session_${visit.id || index}`;
          const ts =
            this.resolveDate(visit, 'timestamp') ||
            this.resolveDate(visit, 'createdAt') ||
            new Date();

          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
              first: ts,
              last: ts,
              pages: 0,
              engagementMs: 0,
              explicitBounce: null,
            });
          }

          const session = sessions.get(sessionId);
          const eventType = String(visit.eventType || 'pageview').toLowerCase();
          const isPageView = eventType !== 'engagement';
          if (isPageView) {
            session.pages += 1;
          }
          if (
            typeof visit.engagementTimeMs === 'number' &&
            Number.isFinite(visit.engagementTimeMs)
          ) {
            session.engagementMs = Math.max(
              session.engagementMs,
              Math.max(0, visit.engagementTimeMs)
            );
          }
          if (typeof visit.isBounce === 'boolean') {
            session.explicitBounce = visit.isBounce;
          }
          if (ts < session.first) session.first = ts;
          if (ts > session.last) session.last = ts;
        });

        const sessionList = Array.from(sessions.values());
        const sessionsCount = sessionList.length;
        const totalPages = sessionList.reduce((sum, s) => sum + s.pages, 0);
        const bouncedSessions = sessionList.filter(s => {
          if (typeof s.explicitBounce === 'boolean') return s.explicitBounce;
          return s.pages <= 1;
        }).length;
        const totalDurationSec = sessionList.reduce((sum, s) => {
          const timestampDuration = Math.max(0, (s.last.getTime() - s.first.getTime()) / 1000);
          const engagementDuration = Math.max(0, s.engagementMs / 1000);
          return sum + Math.max(timestampDuration, engagementDuration);
        }, 0);

        return {
          sessionsCount,
          totalPages,
          bouncedSessions,
          avgDurationSec: sessionsCount > 0 ? totalDurationSec / sessionsCount : 0,
          pagesPerSession: sessionsCount > 0 ? totalPages / sessionsCount : 0,
          bounceRatePct: sessionsCount > 0 ? (bouncedSessions / sessionsCount) * 100 : 0,
        };
      };

      const currentSessionAnalytics = getSessionAnalytics(currentVisits);
      const previousSessionAnalytics = getSessionAnalytics(previousVisits);

      // Calcular tasa de conversión sobre sesiones (más estable que sobre hits)
      const currentConversion =
        currentSessionAnalytics.sessionsCount > 0
          ? (currentOrders.length / currentSessionAnalytics.sessionsCount) * 100
          : 0;
      const previousConversion =
        previousSessionAnalytics.sessionsCount > 0
          ? (previousOrders.length / previousSessionAnalytics.sessionsCount) * 100
          : 0;

      const formatDuration = seconds => {
        const safe = Math.max(0, Math.round(seconds));
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
      };

      return {
        revenue: {
          value: new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
          }).format(currentRevenue),
          change: calculateChange(currentRevenue, previousRevenue),
        },
        activeUsers: {
          value: currentUsers.length,
          change: calculateChange(currentUsers.length, previousUsers.length),
        },
        conversionRate: {
          value: currentConversion.toFixed(1) + '%',
          change: calculateChange(currentConversion, previousConversion),
        },
        avgTime: {
          value: formatDuration(currentSessionAnalytics.avgDurationSec),
          change: calculateChange(
            currentSessionAnalytics.avgDurationSec,
            previousSessionAnalytics.avgDurationSec
          ),
        },
        pagesPerSession: {
          value: currentSessionAnalytics.pagesPerSession.toFixed(2),
          change: calculateChange(
            currentSessionAnalytics.pagesPerSession,
            previousSessionAnalytics.pagesPerSession
          ),
        },
        bounceRate: {
          value: `${currentSessionAnalytics.bounceRatePct.toFixed(1)}%`,
          change: calculateChange(
            currentSessionAnalytics.bounceRatePct,
            previousSessionAnalytics.bounceRatePct
          ),
        },
      };
    }
  };
}

export function initAnalyticsManager() {
  if (window.__ANALYTICS_MANAGER_INITED__) {
    return;
  }

  window.__ANALYTICS_MANAGER_INITED__ = true;

  if (!window.analyticsManager) {
    window.analyticsManager = new window.AnalyticsManager();
  }
}

if (typeof window !== 'undefined' && !window.__ANALYTICS_MANAGER_NO_AUTO__) {
  initAnalyticsManager();
}
