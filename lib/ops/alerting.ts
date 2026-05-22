/**
 * Alerting System for Critical Events
 * 
 * Features:
 * - Multiple notification channels (Slack, webhook, email)
 * - Alert severity levels
 * - Rate limiting to prevent alert fatigue
 * - Alert aggregation
 */

import { logger } from '@/lib/observability/logger';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

// Alert cooldown to prevent spam (in ms)
const ALERT_COOLDOWNS: Record<AlertSeverity, number> = {
  info: 60 * 1000,      // 1 minute
  warning: 30 * 1000,   // 30 seconds
  error: 10 * 1000,     // 10 seconds
  critical: 0,          // No cooldown for critical
};

// Track last alert time per source+title
const lastAlertTimes = new Map<string, number>();

/**
 * Slack Webhook Channel
 */
export class SlackChannel implements AlertChannel {
  name = 'slack';
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  }

  async send(alert: Alert): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const colorMap: Record<AlertSeverity, string> = {
      info: '#36a64f',
      warning: '#ff9800',
      error: '#f44336',
      critical: '#9c27b0',
    };

    const payload = {
      attachments: [
        {
          color: colorMap[alert.severity],
          title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          text: alert.message,
          fields: [
            { title: 'Source', value: alert.source, short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          ],
          footer: 'PowerDon Alerting',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error: error instanceof Error ? error : String(error) });
    }
  }
}

/**
 * Generic Webhook Channel
 */
export class WebhookChannel implements AlertChannel {
  name = 'webhook';
  private webhookUrl: string;
  private headers: Record<string, string>;

  constructor(webhookUrl?: string, headers?: Record<string, string>) {
    this.webhookUrl = webhookUrl || process.env.ALERT_WEBHOOK_URL || '';
    this.headers = headers || {};
  }

  async send(alert: Alert): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      logger.error('Failed to send webhook alert', { error: error instanceof Error ? error : String(error) });
    }
  }
}

/**
 * PagerDuty Channel for critical alerts
 */
export class PagerDutyChannel implements AlertChannel {
  name = 'pagerduty';
  private routingKey: string;

  constructor(routingKey?: string) {
    this.routingKey = routingKey || process.env.PAGERDUTY_ROUTING_KEY || '';
  }

  async send(alert: Alert): Promise<void> {
    if (!this.routingKey) {
      return;
    }

    const severityMap: Record<AlertSeverity, string> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };

    const payload = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: `${alert.source}:${alert.title}`,
      payload: {
        summary: `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`,
        severity: severityMap[alert.severity],
        source: alert.source,
        timestamp: alert.timestamp.toISOString(),
        custom_details: alert.metadata,
      },
    };

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.error('Failed to send PagerDuty alert', { error: error instanceof Error ? error : String(error) });
    }
  }
}

/**
 * Alerting Manager
 */
class AlertManager {
  private channels: AlertChannel[] = [];
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;

  constructor() {
    // Initialize default channels based on environment
    if (process.env.SLACK_WEBHOOK_URL) {
      this.channels.push(new SlackChannel());
    }
    if (process.env.ALERT_WEBHOOK_URL) {
      this.channels.push(new WebhookChannel());
    }
    if (process.env.PAGERDUTY_ROUTING_KEY) {
      this.channels.push(new PagerDutyChannel());
    }
  }

  /**
   * Add a notification channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Check if alert should be rate limited
   */
  private shouldRateLimit(alert: Alert): boolean {
    const key = `${alert.source}:${alert.title}`;
    const lastTime = lastAlertTimes.get(key);
    const cooldown = ALERT_COOLDOWNS[alert.severity];

    if (lastTime && Date.now() - lastTime < cooldown) {
      return true;
    }

    lastAlertTimes.set(key, Date.now());
    return false;
  }

  /**
   * Send an alert to all configured channels
   */
  async send(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
    };

    // Check rate limiting
    if (this.shouldRateLimit(fullAlert)) {
      logger.debug('Alert rate limited', { source: fullAlert.source, title: fullAlert.title });
      return;
    }

    // Log the alert
    const logMethod = fullAlert.severity === 'critical' ? 'fatal' :
                      fullAlert.severity === 'error' ? 'error' :
                      fullAlert.severity === 'warning' ? 'warn' : 'info';
    logger[logMethod](`ALERT: ${fullAlert.title}`, {
      alertId: fullAlert.id,
      source: fullAlert.source,
      ...fullAlert.metadata,
    });

    // Store in history
    this.alertHistory.push(fullAlert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }

    // Send to all channels in parallel
    await Promise.allSettled(
      this.channels.map(channel => channel.send(fullAlert))
    );
  }

  /**
   * Get recent alerts
   */
  getHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get active (unresolved) alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alertHistory.filter(a => !a.resolved);
  }
}

// Export singleton instance
export const alertManager = new AlertManager();

// Convenience functions for common alerts
export const alerts = {
  stationOffline(deviceId: string, lastSeen?: Date): Promise<void> {
    return alertManager.send({
      severity: 'warning',
      title: 'Station Offline',
      message: `Station ${deviceId} has gone offline`,
      source: 'station-monitor',
      metadata: { deviceId, lastSeen: lastSeen?.toISOString() },
    });
  },

  stationError(deviceId: string, error: string): Promise<void> {
    return alertManager.send({
      severity: 'error',
      title: 'Station Error',
      message: `Station ${deviceId} reported error: ${error}`,
      source: 'station-monitor',
      metadata: { deviceId, error },
    });
  },

  unlockFailed(stationId: string, slotNumber: number, reason: string): Promise<void> {
    return alertManager.send({
      severity: 'error',
      title: 'Unlock Failed',
      message: `Failed to unlock slot ${slotNumber} on station ${stationId}: ${reason}`,
      source: 'rental-service',
      metadata: { stationId, slotNumber, reason },
    });
  },

  highFailureRate(service: string, rate: number): Promise<void> {
    return alertManager.send({
      severity: 'critical',
      title: 'High Failure Rate',
      message: `${service} is experiencing ${(rate * 100).toFixed(1)}% failure rate`,
      source: 'health-monitor',
      metadata: { service, failureRate: rate },
    });
  },

  databaseConnectionError(error: string): Promise<void> {
    return alertManager.send({
      severity: 'critical',
      title: 'Database Connection Error',
      message: `Failed to connect to database: ${error}`,
      source: 'database',
      metadata: { error },
    });
  },

  lowInventory(stationId: string, available: number, total: number): Promise<void> {
    return alertManager.send({
      severity: 'info',
      title: 'Low Inventory',
      message: `Station ${stationId} has low inventory: ${available}/${total} power banks available`,
      source: 'inventory-monitor',
      metadata: { stationId, available, total },
    });
  },
};
