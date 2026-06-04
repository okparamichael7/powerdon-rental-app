/**
 * Authentication and Authorization Middleware
 * 
 * Features:
 * - JWT validation
 * - API key authentication for internal services
 * - Role-based access control
 * - Admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/observability/logger';
import { resolveStaffAccess } from '@/lib/security/staff-access';

export type UserRole = 'user' | 'admin' | 'operator' | 'service';

export interface AuthContext {
  userId: string;
  email?: string;
  role: UserRole;
  isAdmin: boolean;
  isService: boolean;
}

/**
 * Verify Supabase session and extract user info
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    const { role: staffRole } = await resolveStaffAccess(user.id, {
      app_metadata: user.app_metadata as Record<string, unknown>,
      user_metadata: user.user_metadata as Record<string, unknown>,
    })
    const isAdmin = staffRole === 'admin'
    const role: UserRole = staffRole ?? 'user'

    return {
      userId: user.id,
      email: user.email,
      role,
      isAdmin,
      isService: false,
    };
  } catch (error) {
    logger.error('Auth context extraction failed', { error: error instanceof Error ? error : String(error) });
    return null;
  }
}

/**
 * Verify API key for internal service-to-service calls
 */
export function verifyApiKey(request: NextRequest): AuthContext | null {
  const apiKey = request.headers.get('x-api-key') || 
                 request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return null;
  }
  
  // Check against configured API keys
  const validKeys: Record<string, { name: string; role: UserRole }> = {
    [process.env.TCP_PROXY_API_KEY || '']: { name: 'tcp-proxy', role: 'service' },
    [process.env.ADMIN_API_KEY || '']: { name: 'admin-service', role: 'admin' },
    [process.env.INTERNAL_API_KEY || '']: { name: 'internal', role: 'service' },
  };
  
  const keyConfig = validKeys[apiKey];
  if (!keyConfig || !apiKey) {
    return null;
  }
  
  return {
    userId: `service:${keyConfig.name}`,
    role: keyConfig.role,
    isAdmin: keyConfig.role === 'admin',
    isService: true,
  };
}

/**
 * Combined auth check - tries session first, then API key
 */
export async function authenticate(request: NextRequest): Promise<AuthContext | null> {
  // First try API key (faster, no DB lookup)
  const apiKeyAuth = verifyApiKey(request);
  if (apiKeyAuth) {
    return apiKeyAuth;
  }
  
  // Then try session auth
  return await getAuthContext(request);
}

/**
 * Middleware that requires authentication
 */
export function requireAuth<T>(
  handler: (request: NextRequest, auth: AuthContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const auth = await authenticate(request);
    
    if (!auth) {
      logger.warn('Unauthorized request', {
        path: new URL(request.url).pathname,
        method: request.method,
      });
      
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      ) as NextResponse<T>;
    }
    
    return handler(request, auth);
  };
}

/**
 * Middleware that requires admin role
 */
export function requireAdmin<T>(
  handler: (request: NextRequest, auth: AuthContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const auth = await authenticate(request);
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      ) as NextResponse<T>;
    }
    
    if (!auth.isAdmin && auth.role !== 'operator') {
      logger.warn('Forbidden request - admin required', {
        path: new URL(request.url).pathname,
        userId: auth.userId,
        role: auth.role,
      });
      
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      ) as NextResponse<T>;
    }
    
    return handler(request, auth);
  };
}

/**
 * Middleware that requires service role (internal API calls only)
 */
export function requireService<T>(
  handler: (request: NextRequest, auth: AuthContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const auth = verifyApiKey(request);
    
    if (!auth || !auth.isService) {
      logger.warn('Forbidden request - service key required', {
        path: new URL(request.url).pathname,
      });
      
      return NextResponse.json(
        { error: 'Forbidden', code: 'SERVICE_KEY_REQUIRED' },
        { status: 403 }
      ) as NextResponse<T>;
    }
    
    return handler(request, auth);
  };
}

/**
 * Middleware that allows either auth or continues without (for public endpoints)
 */
export function optionalAuth<T>(
  handler: (request: NextRequest, auth: AuthContext | null) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const auth = await authenticate(request);
    return handler(request, auth);
  };
}

/**
 * Check if request is from allowed IP (for internal endpoints)
 */
export function isAllowedIP(request: NextRequest): boolean {
  const allowedIPs = (process.env.ALLOWED_IPS || '').split(',').filter(Boolean);
  
  if (allowedIPs.length === 0) {
    // No IP restriction configured
    return true;
  }
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
  
  return allowedIPs.includes(clientIP) || allowedIPs.includes('*');
}

/**
 * Middleware that restricts to allowed IPs
 */
export function requireAllowedIP<T>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    if (!isAllowedIP(request)) {
      logger.warn('Request from disallowed IP', {
        path: new URL(request.url).pathname,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      
      return NextResponse.json(
        { error: 'Forbidden', code: 'IP_NOT_ALLOWED' },
        { status: 403 }
      ) as NextResponse<T>;
    }
    
    return handler(request);
  };
}
