/**
 * Request Tracing for Distributed Systems
 * 
 * Features:
 * - Correlation ID propagation
 * - Request/response logging
 * - Performance timing
 * - Error tracking integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { httpMetrics } from './metrics';

// Header names for trace context
export const TRACE_HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  TRACE_ID: 'x-trace-id',
  SPAN_ID: 'x-span-id',
  USER_ID: 'x-user-id',
};

export interface TraceContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  startTime: number;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Extract or create trace context from request
 */
export function extractTraceContext(request: NextRequest): TraceContext {
  const requestId = request.headers.get(TRACE_HEADERS.REQUEST_ID) || generateId();
  const correlationId = request.headers.get(TRACE_HEADERS.CORRELATION_ID) || requestId;
  const traceId = request.headers.get(TRACE_HEADERS.TRACE_ID) || undefined;
  const spanId = request.headers.get(TRACE_HEADERS.SPAN_ID) || undefined;
  const userId = request.headers.get(TRACE_HEADERS.USER_ID) || undefined;

  return {
    requestId,
    correlationId,
    traceId,
    spanId,
    userId,
    startTime: performance.now(),
  };
}

/**
 * Add trace headers to outgoing response
 */
export function addTraceHeaders(response: NextResponse, context: TraceContext): NextResponse {
  response.headers.set(TRACE_HEADERS.REQUEST_ID, context.requestId);
  response.headers.set(TRACE_HEADERS.CORRELATION_ID, context.correlationId);
  if (context.traceId) {
    response.headers.set(TRACE_HEADERS.TRACE_ID, context.traceId);
  }
  return response;
}

/**
 * Create a traced fetch wrapper for outgoing HTTP calls
 */
export function createTracedFetch(context: TraceContext) {
  return async function tracedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    
    const headers = new Headers(init?.headers);
    headers.set(TRACE_HEADERS.REQUEST_ID, generateId());
    headers.set(TRACE_HEADERS.CORRELATION_ID, context.correlationId);
    if (context.userId) {
      headers.set(TRACE_HEADERS.USER_ID, context.userId);
    }

    const start = performance.now();
    
    try {
      const response = await fetch(input, { ...init, headers });
      const duration = Math.round(performance.now() - start);
      
      logger.debug('Outgoing HTTP request', {
        requestId: context.requestId,
        method,
        url,
        status: response.status,
        duration,
      });
      
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      
      logger.error('Outgoing HTTP request failed', {
        requestId: context.requestId,
        method,
        url,
        duration,
        error: error instanceof Error ? error : String(error),
      });
      
      throw error;
    }
  };
}

/**
 * Middleware wrapper for API routes with tracing
 */
export function withTracing<T>(
  handler: (request: NextRequest, context: TraceContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const traceContext = extractTraceContext(request);
    const path = new URL(request.url).pathname;
    const method = request.method;

    // Log incoming request
    logger.debug('Incoming request', {
      requestId: traceContext.requestId,
      correlationId: traceContext.correlationId,
      method,
      path,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    try {
      const response = await handler(request, traceContext);
      const duration = Math.round(performance.now() - traceContext.startTime);

      // Log response
      logger.request(method, path, response.status, duration, {
        requestId: traceContext.requestId,
        correlationId: traceContext.correlationId,
      });

      // Record metrics
      httpMetrics.request(method, path, response.status, duration);

      // Add trace headers to response
      return addTraceHeaders(response, traceContext);
    } catch (error) {
      const duration = Math.round(performance.now() - traceContext.startTime);

      logger.error('Request failed', {
        requestId: traceContext.requestId,
        correlationId: traceContext.correlationId,
        method,
        path,
        duration,
        error: error instanceof Error ? error : String(error),
      });

      httpMetrics.request(method, path, 500, duration);

      throw error;
    }
  };
}

/**
 * Async local storage for trace context (for nested function calls)
 */
import { AsyncLocalStorage } from 'async_hooks';

const traceStorage = new AsyncLocalStorage<TraceContext>();

export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export function getRequestId(): string | undefined {
  return traceStorage.getStore()?.requestId;
}

export function getCorrelationId(): string | undefined {
  return traceStorage.getStore()?.correlationId;
}
