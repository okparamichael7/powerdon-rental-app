import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { mapAdminHardwareFromDb } from '@/lib/mappers/hardware-mappers'
import { validateBody, schemas } from '@/lib/security/validation'
import type { StationStatus } from '@/lib/db/types'
import { isSchemaGapError } from '@/lib/db/schema-compat'

function mapHardwareMutationError(error: unknown): HardwareAdminError | null {
  if (!(error && typeof error === 'object')) return null
  const e = error as { code?: string; message?: string }
  const message = e.message ?? ''

  if (e.code === '23505' || message.toLowerCase().includes('duplicate key')) {
    return new HardwareAdminError(
      'DUPLICATE_EXTERNAL_ID',
      'A station with this identifier already exists',
    )
  }

  if (message.includes('value too long')) {
    return new HardwareAdminError(
      'IDENTIFIER_TOO_LONG',
      'Hardware identifier is too long. Use a shorter serial or IMEI (32 characters max on this database).',
    )
  }

  if (isSchemaGapError(e)) {
    return new HardwareAdminError(
      'SCHEMA_OUT_OF_DATE',
      'Database schema is missing required columns. Apply pending Supabase migrations (019+).',
    )
  }

  return null
}

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
    const mapped =
      error instanceof HardwareAdminError ? error : mapHardwareMutationError(error)
    if (mapped) {
      const status =
        mapped.code === 'DUPLICATE_EXTERNAL_ID'
          ? 409
          : mapped.code === 'SCHEMA_OUT_OF_DATE'
            ? 503
            : 400
      return NextResponse.json(
        { success: false, error: mapped.message, code: mapped.code },
        { status },
      )
    }
    console.error('[Admin] station create:', error)
    return NextResponse.json({ success: false, error: 'Failed to create hardware' }, { status: 500 })
  }
}
