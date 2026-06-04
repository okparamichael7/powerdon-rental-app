/**
 * Structured Logger for Production Observability
 * 
 * Features:
 * - JSON structured logging for log aggregation (Datadog, Splunk, etc.)
 * - Log levels with environment-aware filtering
 * - Request correlation IDs for distributed tracing
 * - Sensitive data redaction
 * - Performance timing helpers
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  // Request context
  requestId?: string;
  userId?: string;
  sessionId?: string;
  
  // Station context
  stationId?: string;
  deviceId?: string;
  slotNumber?: number;
  
  // Operation context
  operation?: string;
  duration?: number;
  
  // Error context
  error?: Error | string;
  errorCode?: string;
  
  // Additional metadata
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  version: string;
  context: LogContext;
}

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'creditCard',
  'credit_card',
  'ssn',
  'email',
  'phone',
];

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class Logger {
  private service: string;
  private environment: string;
  private version: string;
  private minLevel: LogLevel;
  private defaultContext: LogContext;

  constructor() {
    this.service = process.env.SERVICE_NAME || 'powerdon-api';
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.APP_VERSION || '1.0.0';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.environment === 'production' ? 'info' : 'debug');
    this.defaultContext = {};
  }

  /**
   * Create a child logger with additional default context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.defaultContext = { ...this.defaultContext, ...context };
    return child;
  }

  /**
   * Redact sensitive fields from an object
   */
  private redact(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.redact(item));
    }
    
    if (typeof obj === 'object') {
      const redacted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redact(value);
        }
      }
      return redacted;
    }
    
    return obj;
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error | string | unknown): Record<string, unknown> {
    if (error instanceof Error) {
      const { name, message, stack, ...rest } = error as Error & Record<string, unknown>;
      return { name, message, stack, ...rest };
    }
    return { message: String(error) };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      version: this.version,
      context: this.redact({ ...this.defaultContext, ...context }) as LogContext,
    };

    // Format error if present
    if (context.error) {
      entry.context.error = this.formatError(context.error) as unknown as string;
    }

    // In production, output JSON for log aggregation
    if (this.environment === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      // In development, use colored console output
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        fatal: '\x1b[35m', // magenta
      };
      const reset = '\x1b[0m';
      const color = colors[level];
      
      console.log(
        `${color}[${entry.timestamp}] ${level.toUpperCase()}${reset} ${message}`,
        Object.keys(entry.context).length > 0 ? entry.context : ''
      );
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.log('fatal', message, context);
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.debug(`${operation} completed`, { operation, duration });
      return duration;
    };
  }

  /**
   * Start a span for tracing (lightweight implementation)
   * Returns an object with end() method for compatibility with tracing patterns
   */
  startSpan(name: string, context?: LogContext): { end: () => number; addAttribute: (key: string, value: unknown) => void } {
    const start = performance.now();
    const attributes: Record<string, unknown> = {};
    
    this.debug(`Span started: ${name}`, { ...context, spanName: name });
    
    return {
      addAttribute: (key: string, value: unknown) => {
        attributes[key] = value;
      },
      end: () => {
        const duration = Math.round(performance.now() - start);
        this.debug(`Span ended: ${name}`, { 
          ...context, 
          spanName: name, 
          duration,
          attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        });
        return duration;
      },
    };
  }

  /**
   * Log an HTTP request
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${statusCode}`, {
      ...context,
      httpMethod: method,
      httpPath: path,
      httpStatus: statusCode,
      duration,
    });
  }

  /**
   * Log a station command
   */
  command(
    commandType: string,
    stationId: string,
    success: boolean,
    context?: LogContext
  ): void {
    const level: LogLevel = success ? 'info' : 'error';
    this.log(level, `Station command: ${commandType}`, {
      ...context,
      stationId,
      commandType,
      success,
    });
  }

  /**
   * Log a rental session event
   */
  session(
    event: string,
    sessionId: string,
    context?: LogContext
  ): void {
    this.info(`Session ${event}`, {
      ...context,
      sessionId,
      sessionEvent: event,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for creating child loggers
export { Logger };
