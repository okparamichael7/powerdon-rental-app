import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { mapStationFromDb } from '@/lib/mappers/domain-mappers'
import type { StationStatus } from '@/lib/db/types'
import { validateBody, schemas } from '@/lib/security/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const station = await stationRepository.getById(id)
  if (!station) {
    return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: mapStationFromDb(station) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const validated = await validateBody(request, schemas.updateStation)
  if (!validated.success) return validated.error
  const body = validated.data

  try {
    const updated = await stationRepository.update(id, {
      status: body.status as StationStatus | undefined,
      is_enabled: body.isEnabled,
      name: body.name,
      location: body.location,
    })
    const station = await stationRepository.getById(updated.id)
    if (!station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: mapStationFromDb(station) })
  } catch (error) {
    console.error('[Admin] station update:', error)
    return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 })
  }
}
