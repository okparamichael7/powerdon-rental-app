import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { mapAdminSlotFromDb } from '@/lib/mappers/hardware-mappers'
import { validateBody, schemas } from '@/lib/security/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotNumber: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.slot.manage')
  if (!auth.ok) return auth.response

  const { id, slotNumber: slotNumberRaw } = await params
  const slotNumber = Number(slotNumberRaw)
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 100) {
    return NextResponse.json({ success: false, error: 'Invalid slot number' }, { status: 400 })
  }

  const validated = await validateBody(request, schemas.updateStationSlot)
  if (!validated.success) return validated.error
  const body = validated.data

  try {
    const updated = await hardwareAdminService.updateSlot(auth.auth.userId, id, slotNumber, {
      label: body.label,
      status: body.status,
      errorMessage: body.errorMessage,
    })

    return NextResponse.json({
      success: true,
      data: mapAdminSlotFromDb(updated),
    })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'NOT_FOUND' || error.code === 'SLOT_NOT_FOUND' ? 404 : 409 },
      )
    }
    console.error('[Admin] slot update:', error)
    return NextResponse.json({ success: false, error: 'Failed to update slot' }, { status: 500 })
  }
}
