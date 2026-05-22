/**
 * Metrics Collection for Production Monitoring
 * 
 * Features:
 * - Counter, Gauge, Histogram metrics
 * - Prometheus-compatible /metrics endpoint
 * - Business metrics (sessions, revenue, etc.)
 * - System metrics (connections, latency, etc.)
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labels?: string[];
}

interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface HistogramValue {
  sum: number;
  count: number;
  buckets: Map<number, number>;
  labels: Record<string, string>;
}

// Default histogram buckets for latency (in ms)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

class MetricsRegistry {
  private counters: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, MetricValue[]> = new Map();
  private histograms: Map<string, HistogramValue[]> = new Map();
  private definitions: Map<string, MetricDefinition> = new Map();

  constructor() {
    // Register default metrics
    this.registerDefaultMetrics();
  }

  private registerDefaultMetrics(): void {
    // HTTP metrics
    this.define({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter',
      labels: ['method', 'path', 'status'],
    });

    this.define({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      type: 'histogram',
      labels: ['method', 'path'],
    });

    // Station metrics
    this.define({
      name: 'stations_connected',
      help: 'Number of currently connected stations',
      type: 'gauge',
    });

    this.define({
      name: 'station_commands_total',
      help: 'Total station commands sent',
      type: 'counter',
      labels: ['command_type', 'status'],
    });

    this.define({
      name: 'station_command_latency_ms',
      help: 'Station command round-trip latency in milliseconds',
      type: 'histogram',
      labels: ['command_type'],
    });

    // Session metrics
    this.define({
      name: 'rental_sessions_total',
      help: 'Total rental sessions',
      type: 'counter',
      labels: ['status'],
    });

    this.define({
      name: 'rental_sessions_active',
      help: 'Currently active rental sessions',
      type: 'gauge',
    });

    this.define({
      name: 'rental_duration_minutes',
      help: 'Rental session duration in minutes',
      type: 'histogram',
      labels: ['campaign'],
    });

    // Revenue metrics
    this.define({
      name: 'revenue_total_cents',
      help: 'Total revenue in cents',
      type: 'counter',
      labels: ['type'],
    });

    // Power bank metrics
    this.define({
      name: 'power_banks_available',
      help: 'Number of available power banks',
      type: 'gauge',
      labels: ['station_id'],
    });

    this.define({
      name: 'power_banks_rented',
      help: 'Number of currently rented power banks',
      type: 'gauge',
    });

    // Error metrics
    this.define({
      name: 'errors_total',
      help: 'Total errors',
      type: 'counter',
      labels: ['type', 'code'],
    });
  }

  /**
   * Define a new metric
   */
  define(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  /**
   * Get or create a labels key
   */
  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Find or create metric value for labels
   */
  private findOrCreateValue(
    map: Map<string, MetricValue[]>,
    name: string,
    labels: Record<string, string>
  ): MetricValue {
    if (!map.has(name)) {
      map.set(name, []);
    }
    const values = map.get(name)!;
    const key = this.labelsKey(labels);
    let value = values.find(v => this.labelsKey(v.labels) === key);
    if (!value) {
      value = { value: 0, labels, timestamp: Date.now() };
      values.push(value);
    }
    return value;
  }

  /**
   * Increment a counter
   */
  inc(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const value = this.findOrCreateValue(this.counters, name, labels);
    value.value += amount;
    value.timestamp = Date.now();
  }

  /**
   * Set a gauge value
   */
  set(name: string, amount: number, labels: Record<string, string> = {}): void {
    const value = this.findOrCreateValue(this.gauges, name, labels);
    value.value = amount;
    value.timestamp = Date.now();
  }

  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const value = this.findOrCreateValue(this.gauges, name, labels);
    value.value += amount;
    value.timestamp = Date.now();
  }

  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const value = this.findOrCreateValue(this.gauges, name, labels);
    value.value -= amount;
    value.timestamp = Date.now();
  }

  /**
   * Observe a histogram value
   */
  observe(name: string, amount: number, labels: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const values = this.histograms.get(name)!;
    const key = this.labelsKey(labels);
    let histogram = values.find(v => this.labelsKey(v.labels) === key);
    
    if (!histogram) {
      histogram = {
        sum: 0,
        count: 0,
        buckets: new Map(DEFAULT_BUCKETS.map(b => [b, 0])),
        labels,
      };
      values.push(histogram);
    }

    histogram.sum += amount;
    histogram.count += 1;
    
    for (const bucket of DEFAULT_BUCKETS) {
      if (amount <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  /**
   * Create a timer that observes duration when stopped
   */
  startTimer(name: string, labels: Record<string, string> = {}): () => number {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.observe(name, duration, labels);
      return duration;
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // Export counters
    for (const [name, values] of this.counters) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} counter`);
      }
      for (const { value, labels } of values) {
        const labelStr = this.labelsKey(labels);
        lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`);
      }
    }

    // Export gauges
    for (const [name, values] of this.gauges) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} gauge`);
      }
      for (const { value, labels } of values) {
        const labelStr = this.labelsKey(labels);
        lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`);
      }
    }

    // Export histograms
    for (const [name, values] of this.histograms) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} histogram`);
      }
      for (const { sum, count, buckets, labels } of values) {
        const labelStr = this.labelsKey(labels);
        const baseLabel = labelStr ? `${labelStr},` : '';
        
        for (const [bucket, bucketCount] of buckets) {
          lines.push(`${name}_bucket{${baseLabel}le="${bucket}"} ${bucketCount}`);
        }
        lines.push(`${name}_bucket{${baseLabel}le="+Inf"} ${count}`);
        lines.push(`${name}_sum${labelStr ? `{${labelStr}}` : ''} ${sum}`);
        lines.push(`${name}_count${labelStr ? `{${labelStr}}` : ''} ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON (for internal dashboards)
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          values.map(v => ({
            ...v,
            buckets: Object.fromEntries(v.buckets),
          })),
        ])
      ),
    };
    return result;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Export singleton instance
export const metrics = new MetricsRegistry();

// Export for creating additional registries
export { MetricsRegistry };

// Helper functions for common metrics
export const httpMetrics = {
  request(method: string, path: string, status: number, duration: number): void {
    metrics.inc('http_requests_total', { method, path, status: String(status) });
    metrics.observe('http_request_duration_ms', duration, { method, path });
  },
};

export const stationMetrics = {
  connected(count: number): void {
    metrics.set('stations_connected', count);
  },
  command(type: string, success: boolean, latency?: number): void {
    metrics.inc('station_commands_total', { command_type: type, status: success ? 'success' : 'failure' });
    if (latency !== undefined) {
      metrics.observe('station_command_latency_ms', latency, { command_type: type });
    }
  },
  powerBanksAvailable(stationId: string, count: number): void {
    metrics.set('power_banks_available', count, { station_id: stationId });
  },
};

export const sessionMetrics = {
  started(): void {
    metrics.inc('rental_sessions_total', { status: 'started' });
    metrics.incGauge('rental_sessions_active');
  },
  completed(durationMinutes: number, campaign?: string): void {
    metrics.inc('rental_sessions_total', { status: 'completed' });
    metrics.decGauge('rental_sessions_active');
    metrics.observe('rental_duration_minutes', durationMinutes, { campaign: campaign || 'default' });
  },
  failed(): void {
    metrics.inc('rental_sessions_total', { status: 'failed' });
    metrics.decGauge('rental_sessions_active');
  },
  revenue(amountCents: number, type: 'rental' | 'deposit' | 'refund'): void {
    metrics.inc('revenue_total_cents', { type }, amountCents);
  },
};

export const errorMetrics = {
  record(type: string, code?: string): void {
    metrics.inc('errors_total', { type, code: code || 'unknown' });
  },
};
