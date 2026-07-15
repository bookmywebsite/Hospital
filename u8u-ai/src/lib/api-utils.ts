/**
 * API Utilities for error handling, timeouts, and performance monitoring
 */

import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    duration_ms: number;
    timestamp: string;
  };
}

/**
 * Wrapper for API endpoints with timeout protection and error handling
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Safe database query with timeout
 */
export async function safeDbQuery<T>(
  query: () => Promise<T>,
  timeoutMs = 3000,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await withTimeout(query(), timeoutMs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database query error:', { error: msg, timeout_ms: timeoutMs });
    return defaultValue;
  }
}

/**
 * Build paginated result
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    },
  };
}

/**
 * Format performance metrics
 */
export function getMetrics(startTimeMs: number) {
  return {
    duration_ms: Date.now() - startTimeMs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build successful API response
 */
export function apiSuccess<T>(
  data: T,
  duration_ms: number,
  cacheControl = 'private, max-age=10'
): any {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        duration_ms,
        timestamp: new Date().toISOString(),
      },
    },
    {
      headers: {
        'Cache-Control': cacheControl,
        'X-Response-Time': `${duration_ms}ms`,
      },
    }
  );
}

/**
 * Build error API response
 */
export function apiError(
  message: string,
  status = 500,
  duration_ms = 0
): any {
  const statusMap: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    503: 'Service Unavailable',
    500: 'Internal Server Error',
  };

  return NextResponse.json(
    {
      success: false,
      error: message,
      meta: {
        duration_ms,
        timestamp: new Date().toISOString(),
        status,
        statusText: statusMap[status] || 'Unknown',
      },
    },
    { status, headers: { 'X-Response-Time': `${duration_ms}ms` } }
  );
}

/**
 * Standard error handler for API routes
 */
export function handleApiError(error: any, duration_ms: number) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  const isTimeout = msg.includes('timeout');
  const status = isTimeout ? 503 : 500;
  const errorMsg = isTimeout
    ? 'Request timeout - please try again'
    : 'Internal server error';

  console.error('[API Error]', { error: msg, duration_ms, status });

  return apiError(errorMsg, status, duration_ms);
}

/**
 * Validate required fields
 */
export function validateFields(obj: Record<string, any>, required: string[]): string | null {
  for (const field of required) {
    if (!obj[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Parse pagination parameters
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Create a response with cache headers for client-side caching
 */
export function withCacheHeaders(
  response: any,
  cacheControl = 'private, max-age=10, stale-while-revalidate=20'
) {
  return new NextResponse(response.body, {
    ...response,
    headers: {
      ...response.headers,
      'Cache-Control': cacheControl,
    },
  });
}
