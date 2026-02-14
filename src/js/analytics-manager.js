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
        console.log(message);
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
      this.cachedData = null; // ✅ FIX: Cachear datos para renderizar cuando se active la sección
      this.debug = false;
      this.init();
    }

    init() {
      AnalyticsManager.log('debug', 'AnalyticsManager inicializado', this.debug);
      this.setupEventListeners();
      this.initRealTimeUpdates();

      // Auto-refresh al iniciar (con breve delay para asegurar carga del DOM)
      setTimeout(() => this.refreshData(), 500);
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
          AnalyticsManager.log(
            'warn',
            'RealTimeDataService no disponible, usando datos estáticos'
          );
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

        this.realTimeUnsubscribe =
          window.realTimeDataService.subscribeToMultiple({
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
        AnalyticsManager.log(
          'error',
          'Error inicializando actualizaciones en tiempo real',
          error
        );
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
    //       console.log(
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
      AnalyticsManager.log(
        'debug',
        'Suscripciones en tiempo real limpiadas',
        this.debug
      );
    }

    // ==========================================================================
    // CONFIGURACIÓN DE EVENTOS
    // ==========================================================================

    setupEventListeners() {
      // Escuchamos el botón de exportar usando el atributo data-action de tu HTML
      document.addEventListener('click', e => {
        const target = e.target.closest('[data-action="exportAnalytics"]');
        if (target) {
          this.exportToCSV();
        }
      });

      // Manejo de filtros de fecha
      const applyBtn = document.getElementById('applyFilters');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => this.refreshData());
      }

      // Escuchar cambios de pestaña para re-inicializar gráficos cuando sean visibles
      document.addEventListener('click', e => {
        const tabBtn = e.target.closest('[data-action="showAdminSection"]');
        if (tabBtn) {
          const section =
            tabBtn.dataset.params || tabBtn.getAttribute('data-params');
          if (section === 'analytics') {
            // Pequeño delay para que la sección sea visible y tenga dimensiones
            setTimeout(() => {
              AnalyticsManager.log(
                'debug',
                'Refrescando gráficos (entrada en pestaña Analytics)',
                this.debug
              );
              // ✅ FIX: Si hay datos en caché, renderizarlos inmediatamente
              if (this.cachedData) {
                AnalyticsManager.log(
                  'debug',
                  'Renderizando gráficos desde caché',
                  this.debug
                );
                this.renderCharts(this.cachedData);
              } else {
                this.refreshData();
              }
            }, 400);
          }
        }
      });
    }

    // ==========================================================================
    // CONTROL DE DATOS Y UI
    // ==========================================================================

    async refreshData() {
      AnalyticsManager.log(
        'debug',
        'Refrescando dashboard de analytics...',
        this.debug
      );
      try {
        const data = await this.fetchData();
        const metrics = this.calculateCurrentMetrics(data);
        this.updateMetricsUI(metrics);
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
          changeEl.className =
            'metric-change ' + (changeVal >= 0 ? 'positive' : 'negative');
        }
      };

      // Actualizar cartas
      updateElement(
        'revenue',
        metrics.revenue.value,
        'revenueChange',
        metrics.revenue.change
      );
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
      updateElement(
        'avgTime',
        metrics.avgTime.value,
        'avgTimeChange',
        metrics.avgTime.change
      ); // avgTime change es string/num? asumimos num para color
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
            orderDate = order.createdAt
              ? new Date(order.createdAt)
              : new Date();
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
          window.NotificationSystem.show(
            'Reporte descargado con éxito',
            'success'
          );
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

      // ✅ FIX: Guardar datos en caché para renderizar más tarde si es necesario
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

      // Asegurar Chart.js disponible (fallback lazy load)
      const chartReady = await this.ensureChartJs();
      if (!chartReady) {
        AnalyticsManager.log('warn', 'Chart.js no disponible para Analytics');
        return;
      }

      // ✅ FIX: Aumentar delay de 100ms a 500ms para dar más tiempo al layout
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

      // ✅ FIX: Verificar también que el canvas tenga dimensiones
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
        type: 'doughnut',
        data: {
          labels: trafficData.labels,
          datasets: [
            {
              data: trafficData.values,
              backgroundColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderWidth: 0,
              hoverOffset: 15,
            },
          ],
        },
        options: {
          ...this.getChartOptions(),
          cutout: '70%',
          plugins: {
            ...this.getChartOptions().plugins,
            legend: {
              display: true,
              position: 'right',
              labels: {
                color: '#888',
                font: {
                  size: 12,
                },
              },
            },
          },
        },
      });
    }

    async initDevicesChart(deviceData) {
      const ctx = document.getElementById('devicesChart');
      if (!ctx || !(await this.checkContainer(ctx))) return;
      if (!(await this.ensureChartJs())) return;

      if (this.charts.devices) this.charts.devices.destroy();

      this.charts.devices = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: deviceData.labels,
          datasets: [
            {
              data: deviceData.values,
              backgroundColor: ['#00f2ff', '#7000ff', '#ff00c8'],
              borderWidth: 0,
              hoverOffset: 10,
            },
          ],
        },
        options: {
          ...this.getChartOptions(),
          plugins: {
            ...this.getChartOptions().plugins,
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#888',
                padding: 20,
              },
            },
          },
        },
      });
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
                  label += new Intl.NumberFormat('es-ES').format(
                    context.parsed.y
                  );
                  if (
                    context.dataset.label &&
                    context.dataset.label.includes('€')
                  ) {
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
        script.src =
          'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
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
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES DE CARGA DE DATOS
    // ==========================================================================

    async fetchData() {
      if (!window.AdminDataManager)
        return {
          orders: [],
          visits: [],
          users: [],
          trends: {
            labels: [],
            values: [],
          },
        };

      const dataManager =
        window.adminDataManager ||
        (window.AdminDataManager &&
        typeof window.AdminDataManager.getInstance === 'function'
          ? window.AdminDataManager.getInstance()
          : null);

      if (!dataManager || typeof dataManager.getAllData !== 'function') {
        AnalyticsManager.log(
          'warn',
          'AdminDataManager instance not found or getAllData missing'
        );
        return {
          orders: [],
          visits: [],
          trends: {
            labels: [],
            values: [],
          },
        };
      }

      const data = await dataManager.getAllData();
      const orders = data.orders || [];
      const visits = data.visits || [];
      const users = data.users || [];

      // Agrupar ventas por día usando la utilidad
      const salesByDate = this.groupByDate(orders, 'createdAt', 'price');

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
          values: hasSales
            ? Object.values(salesByDate).slice(-7)
            : fillMissingDays(salesByDate),
        },
        userTrends: {
          labels: hasUsers ? Object.keys(usersByDate).slice(-7) : last7Days,
          values: hasUsers
            ? Object.values(usersByDate).slice(-7)
            : fillMissingDays(usersByDate),
        },
        traffic: {
          labels: hasVisits
            ? Object.keys(trafficStats).filter(key => trafficStats[key] > 0)
            : ['Directo', 'Social', 'Referidos'],
          values: hasVisits
            ? Object.values(trafficStats).filter(val => val > 0)
            : [0, 0, 0],
        },
        devices: {
          labels: hasVisits
            ? Object.keys(deviceStats).filter(key => deviceStats[key] > 0)
            : ['Escritorio', 'Móvil', 'Tablet'],
          values: hasVisits
            ? Object.values(deviceStats).filter(val => val > 0)
            : [0, 0, 0],
        },
      };

      // Renderizar gráficos con los datos obtenidos
      this.renderCharts(result);

      return result;
    }

    calculateCurrentMetrics(data) {
      const orders = data.orders || [];
      const visits = data.visits || [];
      const users = data.users || [];

      // Calcular período actual (últimos 7 días)
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Filtrar datos por período
      const filterByPeriod = (
        items,
        startDate,
        endDate,
        dateField = 'createdAt'
      ) => {
        return items.filter(item => {
          let itemDate;
          const dateValue = item[dateField];

          if (dateValue && typeof dateValue.toDate === 'function') {
            itemDate = dateValue.toDate();
          } else if (dateValue) {
            itemDate = new Date(dateValue);
          } else {
            return false;
          }

          return itemDate >= startDate && itemDate < endDate;
        });
      };

      // Datos del período actual
      const currentOrders = filterByPeriod(orders, last7Days, now);
      const currentUsers = filterByPeriod(users, last7Days, now);
      const currentVisits = filterByPeriod(visits, last7Days, now);

      // Datos del período anterior
      const previousOrders = filterByPeriod(orders, previous7Days, last7Days);
      const previousUsers = filterByPeriod(users, previous7Days, last7Days);
      const previousVisits = filterByPeriod(visits, previous7Days, last7Days);

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

      // Calcular tasa de conversión
      const currentConversion =
        currentVisits.length > 0
          ? (currentOrders.length / currentVisits.length) * 100
          : 0;
      const previousConversion =
        previousVisits.length > 0
          ? (previousOrders.length / previousVisits.length) * 100
          : 0;

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
          value: 'N/A',
          change: 0,
        },
        pagesPerSession: {
          value:
            currentVisits.length > 0
              ? (currentVisits.length / currentVisits.length).toFixed(1)
              : '0',
          change: 0,
        },
        bounceRate: {
          value: 'N/A',
          change: 0,
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
