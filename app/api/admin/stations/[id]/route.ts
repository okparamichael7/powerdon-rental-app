import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { mapAdminHardwareFromDb } from '@/lib/mappers/hardware-mappers'
import { validateBody, schemas } from '@/lib/security/validation'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.read')
  if (!auth.ok) return auth.response

  const { id } = await params
  const station = await stationRepository.getById(id)
  if (!station) {
    return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
  }
  return NextResponse.json({
    success: true,
    data: mapAdminHardwareFromDb(station, appOrigin()),
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.update')
  if (!auth.ok) return auth.response

  const { id } = await params
  const validated = await validateBody(request, schemas.updateStationAdmin)
  if (!validated.success) return validated.error
  const body = validated.data

  try {
    const result = await hardwareAdminService.updateHardware(auth.auth.userId, id, {
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

    if (result.slotCountChange && 'blocked' in result.slotCountChange) {
      return NextResponse.json(
        {
          success: false,
          error: 'Slot count reduction blocked',
          code: 'SLOT_COUNT_BLOCKED',
          blockers: result.slotCountChange.blocked,
        },
        { status: 409 },
      )
    }

    const station = await stationRepository.getById(result.station.id)
    if (!station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: mapAdminHardwareFromDb(station, appOrigin()),
      slotCountChange: result.slotCountChange,
    })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'NOT_FOUND' ? 404 : 400 },
      )
    }
    console.error('[Admin] station update:', error)
    return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.delete')
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const blockers = await hardwareAdminService.getDeletionBlockers(id)
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Deletion blocked',
          code: 'DELETE_BLOCKED',
          blockers,
        },
        { status: 409 },
      )
    }

    await hardwareAdminService.deleteHardware(auth.auth.userId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          blockers: error.blockers,
        },
        { status: 409 },
      )
    }
    console.error('[Admin] station delete:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete station' }, { status: 500 })
  }
}
