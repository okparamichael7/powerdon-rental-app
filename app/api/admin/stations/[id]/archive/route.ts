import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { hardwareAdminService, HardwareAdminError } from '@/lib/admin/hardware-admin-service'
import { mapAdminHardwareFromDb } from '@/lib/mappers/hardware-mappers'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHardwarePermission(request, 'hardware.archive')
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    await hardwareAdminService.archiveHardware(auth.auth.userId, id)
    const station = await stationRepository.getById(id)
    if (!station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: mapAdminHardwareFromDb(station, appOrigin()),
    })
  } catch (error) {
    if (error instanceof HardwareAdminError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'NOT_FOUND' ? 404 : 409 },
      )
    }
    console.error('[Admin] station archive:', error)
    return NextResponse.json({ success: false, error: 'Failed to archive hardware' }, { status: 500 })
  }
}
