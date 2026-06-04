import { NextResponse } from 'next/server';
import { metrics } from '@/lib/observability/metrics';

/**
 * GET /api/metrics
 * 
 * Prometheus-compatible metrics endpoint for monitoring systems.
 * This should be protected in production (via IP allowlist or auth).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'prometheus';

  // Check for basic auth or API key in production
  const authHeader = request.headers.get('authorization');
  const apiKey = searchParams.get('key');
  const expectedKey = process.env.METRICS_API_KEY;

  if (process.env.NODE_ENV === 'production' && !expectedKey) {
    return NextResponse.json(
      { error: 'Metrics endpoint disabled: set METRICS_API_KEY' },
      { status: 503 },
    );
  }

  if (expectedKey && authHeader !== `Bearer ${expectedKey}` && apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (format === 'json') {
    return NextResponse.json(metrics.toJSON());
  }

  // Default to Prometheus format
  const prometheusOutput = metrics.toPrometheus();
  
  return new NextResponse(prometheusOutput, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
