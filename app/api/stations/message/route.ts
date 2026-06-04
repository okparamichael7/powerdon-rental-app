// WsCharge v5.8P binary message ingress (TCP proxy → HTTP)
// POST /api/stations/message

import { NextRequest, NextResponse } from 'next/server'
import { processWsChargeHex } from '@/lib/wscharge/protocol-handler'
import { incrementWsChargeMetric } from '@/lib/wscharge/metrics'

export async function POST(request: NextRequest) {
  const { requireServiceOrAdmin } = await import('@/lib/api/route-helpers')
  const auth = await requireServiceOrAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { wsChargeMessageBodySchema } = await import('@/lib/wscharge/validation')
    const parsed = wsChargeMessageBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { stationId, messageHex, connectionId, remoteAddress, correlationId } = parsed.data

    const result = await processWsChargeHex({
      messageHex,
      stationId,
      connectionId,
      remoteAddress,
      correlationId: correlationId || request.headers.get('x-correlation-id') || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    incrementWsChargeMetric('handler_failures')
    console.error('[API] Error processing WsCharge message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
