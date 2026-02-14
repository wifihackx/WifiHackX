/**
 * Monitoreo de Recursos
 *
 * Monitorea uso de memoria y CPU para detectar posibles ataques DoS
 */

export function monitorResources() {
  const usage = process.memoryUsage();
  const timestamp = new Date().toISOString();

  const metrics = {
    timestamp,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
  };

  // Alertar si uso de memoria es alto
  if (metrics.heapUsed > 500) {
    const log = window.Logger || console;
    const cat =
      (window.LOG_CATEGORIES && window.LOG_CATEGORIES.SECURITY) || 'SECURITY';
    (log.warn || log.log)(
      `High memory usage detected: ${metrics.heapUsed}MB`,
      cat
    );
  }

  return metrics;
}

// Monitorear cada 30 segundos en producción
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const metrics = monitorResources();
    const log = window.Logger || console;
    const cat =
      (window.LOG_CATEGORIES && window.LOG_CATEGORIES.SECURITY) || 'SECURITY';
    (log.debug || log.log)('Resource metrics update', cat, metrics);
  }, 30000);
}
