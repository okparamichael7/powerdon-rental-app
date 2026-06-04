/**
 * Input Validation and Sanitization
 * 
 * Features:
 * - Zod schema validation
 * - Input sanitization
 * - SQL injection prevention
 * - XSS prevention
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';

/**
 * Common validation schemas
 */
export const schemas = {
  // UUID validation
  uuid: z.string().uuid(),
  
  // Station device ID (alphanumeric, 8-32 chars)
  deviceId: z.string().regex(/^[A-Za-z0-9]{8,32}$/, 'Invalid device ID format'),
  
  // Slot number (1-12)
  slotNumber: z.number().int().min(1).max(12),
  
  // Email
  email: z.string().email().max(255),
  
  // Session code (alphanumeric, 8 chars)
  sessionCode: z.string().regex(/^[A-Z0-9]{8}$/, 'Invalid session code'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  
  // Date range
  dateRange: z.object({
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
  }),
  
  // Station message (from TCP proxy)
  stationMessage: z.object({
    deviceId: z.string().min(1).max(32),
    messageType: z.string().min(1).max(32),
    data: z.string(), // Base64 encoded binary data
    timestamp: z.string().datetime().optional(),
    connectionId: z.string().optional(),
    ipAddress: z.string().ip().optional(),
  }),
  
  // Rental start request (public API)
  rentalStartPublic: z.object({
    stationId: z.string().uuid(),
    userEmail: z.string().email().max(255),
    userName: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    marketingConsent: z.boolean().optional(),
    campaignId: z.string().uuid().optional(),
    slotNumber: z.number().int().min(1).max(12).optional(),
    paymentMethodId: z.string().max(255).optional(),
  }),

  supportTicket: z.object({
    email: z.string().email().max(255),
    subject: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    category: z.enum([
      'rental_issue',
      'payment_issue',
      'return_issue',
      'reward_issue',
      'station_issue',
      'account_issue',
      'other',
    ]),
    sessionId: z.string().uuid().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    website: z.string().max(0).optional(),
  }),
  
  // Station command request
  stationCommand: z.object({
    command: z.enum(['eject', 'reboot', 'settings', 'inventory']),
    slotNumber: z.number().int().min(1).max(12).optional(),
    settings: z.record(z.unknown()).optional(),
  }),
};

/**
 * Sanitize a string to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Validate request body against a schema
 */
export async function validateBody<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      logger.warn('Request validation failed', {
        path: new URL(request.url).pathname,
        errors: result.error.errors,
      });
      
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: result.error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | string[]> = {};
  
  searchParams.forEach((value, key) => {
    if (params[key]) {
      // Handle multiple values for same key
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });
  
  const result = schema.safeParse(params);
  
  if (!result.success) {
    logger.warn('Query validation failed', {
      path: new URL(request.url).pathname,
      errors: result.error.errors,
    });
    
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  
  return { success: true, data: result.data };
}

/**
 * Validate path parameters
 */
export function validateParams<T extends z.ZodSchema>(
  params: Record<string, string | string[] | undefined>,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const result = schema.safeParse(params);
  
  if (!result.success) {
    logger.warn('Path parameter validation failed', {
      params,
      errors: result.error.errors,
    });
    
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Invalid path parameters',
          code: 'VALIDATION_ERROR',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  
  return { success: true, data: result.data };
}

/**
 * Create a validated request handler
 */
export function withValidation<TBody extends z.ZodSchema, TQuery extends z.ZodSchema>(
  config: {
    body?: TBody;
    query?: TQuery;
  },
  handler: (
    request: NextRequest,
    validated: {
      body?: z.infer<TBody>;
      query?: z.infer<TQuery>;
    }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validated: { body?: z.infer<TBody>; query?: z.infer<TQuery> } = {};
    
    if (config.body) {
      const result = await validateBody(request, config.body);
      if (!result.success) return result.error;
      validated.body = result.data;
    }
    
    if (config.query) {
      const result = validateQuery(request, config.query);
      if (!result.success) return result.error;
      validated.query = result.data;
    }
    
    return handler(request, validated);
  };
}
