import { NextRequest, NextResponse } from 'next/server'
import { buildHealthResponse } from '@/lib/ops/health-response'
import { withPublicApi } from '@/lib/api/public-route'

/**
 * Health check — Kubernetes-style readiness plus WsCharge integration status.
 */
export const GET = withPublicApi(async (_request: NextRequest) => {
  return NextResponse.json(await buildHealthResponse())
}, 'health')
