import { NextRequest, NextResponse } from 'next/server'
import { stationManager } from '@/lib/wscharge'
import { stationRepository } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { requireServiceOrAdmin } = await import('@/lib/api/route-helpers')
  const auth = await requireServiceOrAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { stationId, externalId } = body as { stationId?: string; externalId?: string }
  const productSn = externalId || stationId

  if (!productSn) {
    return NextResponse.json({ success: false, error: 'stationId or externalId required' }, { status: 400 })
  }

  stationManager.handleDisconnect(productSn)

  const dbStation = await stationRepository.getByExternalId(productSn)
  if (dbStation) {
    await stationRepository.updateStatus(dbStation.id, 'offline')
    await stationRepository.logHardwareEvent({
      station_id: dbStation.id,
      station_external_id: productSn,
      event_type: 'disconnect',
      direction: 'inbound',
      parsed_data: { reason: 'tcp_closed' } as import('@/lib/db/types').Json,
    })
  }

  return NextResponse.json({ success: true, stationId: productSn })
}
