import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { mapAdminHardwareFromDb } from '@/lib/mappers/hardware-mappers'
import { validateBody, schemas } from '@/lib/security/validation'
import type { StationStatus } from '@/lib/db/types'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireHardwarePermission(request, 'hardware.read')
  if (!auth.ok) return auth.response

  try {
    const params = request.nextUrl.searchParams
    const search = params.get('search') ?? undefined
    const status = params.get('status')
    const hardwareType = params.get('hardwareType') ?? undefined
    const includeArchived = params.get('includeArchived') === 'true'
    const limit = params.get('limit') ? Number(params.get('limit')) : undefined
    const offset = params.get('offset') ? Number(params.get('offset')) : undefined

    const stations = await stationRepository.getAll({
      search,
      hardwareType,
      includeArchived,
      status: status ? [status as StationStatus] : undefined,
      limit,
      offset,
    })

    const origin = appOrigin()
    return NextResponse.json({
      success: true,
      data: stations.map((s) => mapAdminHardwareFromDb(s, origin)),
      meta: { total: stations.length },
    })
  } catch (error) {
    console.error('[Admin] stations list:', error)
    return NextResponse.json({ success: false, error: 'Failed to load hardware' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireHardwarePermission(request, 'hardware.create')
  if (!auth.ok) return auth.response

  const validated = await validateBody(request, schemas.createStation)
  if (!validated.success) return validated.error
  const body = validated.data

  try {
    const station = await hardwareAdminService.createHardware(auth.auth.userId, {
      name: body.name,
      externalId: body.externalId,
      hardwareType: body.hardwareType,
      description: body.description,
      location: body.location,
      totalSlots: body.totalSlots,
      status: body.status,
      qrReference: body.qrReference,
      externalServiceRef: body.externalServiceRef,
      notes: body.notes,
      campaignId: body.campaignId,
      isEnabled: body.isEnabled,
    })

    const full = await stationRepository.getById(station.id)
    if (!full) {
      return NextResponse.json({ success: false, error: 'Station not found after create' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: mapAdminHardwareFromDb(full, appOrigin()),
    })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'DUPLICATE_EXTERNAL_ID' ? 409 : 400 },
      )
    }
    console.error('[Admin] station create:', error)
    return NextResponse.json({ success: false, error: 'Failed to create hardware' }, { status: 500 })
  }
}
