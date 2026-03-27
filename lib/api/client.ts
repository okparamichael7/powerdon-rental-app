// API client configuration and base utilities
// This module provides the foundation for API communication

import type { ApiResponse, ApiError } from './types';

// Environment configuration
const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Simulated network delay range (ms) for mock mode
const MOCK_DELAY_MIN = 200;
const MOCK_DELAY_MAX = 800;

/**
 * Simulate network latency for mock responses
 */
export async function simulateNetworkDelay(): Promise<void> {
  const delay = Math.random() * (MOCK_DELAY_MAX - MOCK_DELAY_MIN) + MOCK_DELAY_MIN;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate occasional network failures for testing error handling
 * @param failureRate - Probability of failure (0-1)
 */
export function simulateNetworkFailure(failureRate = 0): boolean {
  return Math.random() < failureRate;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(data: T, meta?: { page?: number; limit?: number; total?: number }): ApiResponse<T> {
  return {
    data,
    success: true,
    meta,
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse<T>(code: string, message: string, details?: Record<string, unknown>): ApiResponse<T> {
  return {
    data: null as T,
    success: false,
    error: { code, message, details },
  };
}

/**
 * Common error codes used across the application
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Station errors
  STATION_UNAVAILABLE: 'STATION_UNAVAILABLE',
  STATION_OFFLINE: 'STATION_OFFLINE',
  STATION_FULL: 'STATION_FULL',
  NO_AVAILABLE_SLOTS: 'NO_AVAILABLE_SLOTS',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  UNLOCK_FAILED: 'UNLOCK_FAILED',
  RETURN_FAILED: 'RETURN_FAILED',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  AUTHORIZATION_EXPIRED: 'AUTHORIZATION_EXPIRED',
  REFUND_FAILED: 'REFUND_FAILED',
  
  // Reward errors
  REWARD_NOT_FOUND: 'REWARD_NOT_FOUND',
  REWARD_EXPIRED: 'REWARD_EXPIRED',
  REWARD_ALREADY_REDEEMED: 'REWARD_ALREADY_REDEEMED',
  REWARD_NOT_QUALIFIED: 'REWARD_NOT_QUALIFIED',
  
  // Support errors
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_ALREADY_CLOSED: 'TICKET_ALREADY_CLOSED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a typed error
 */
export function createApiError(code: ErrorCode, message: string, details?: Record<string, unknown>): ApiError {
  return { code, message, details };
}

/**
 * Check if an API response is successful
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } {
  return response.success === true;
}

/**
 * Extract error message from API response
 */
export function getErrorMessage(response: ApiResponse<unknown>): string {
  return response.error?.message || 'An unexpected error occurred';
}

/**
 * Generate a unique ID (for mock data)
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}${randomPart}`.toUpperCase();
}

/**
 * Generate a session code
 */
export function generateSessionCode(): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VR-${random}`;
}

/**
 * Generate a reward code
 */
export function generateRewardCode(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${random}-${year}`;
}

// Export config for testing purposes
export { API_CONFIG };
