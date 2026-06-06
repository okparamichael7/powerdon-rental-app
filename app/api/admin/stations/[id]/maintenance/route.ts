import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { validateBody, schemas } from '@/lib/security/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.update')
  if (!auth.ok) return auth.response

  const { id } = await params
  const validated = await validateBody(request, schemas.createMaintenanceRecord)
  if (!validated.success) return validated.error
  const body = validated.data

  try {
    const record = await hardwareAdminService.createMaintenanceRecord(auth.auth.userId, id, {
      title: body.title,
      description: body.description,
      slotNumber: body.slotNumber,
    })
    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'NOT_FOUND' ? 404 : 400 },
      )
    }
    console.error('[Admin] maintenance create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create maintenance record' },
      { status: 500 },
    )
  }
}
