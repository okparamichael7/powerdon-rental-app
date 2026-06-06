import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import { hardwareAdminService } from '@/lib/admin/hardware-admin-service'
import {
  mapAdminHardwareFromDb,
  mapAdminSlotFromDb,
  mapHardwareAuditEntry,
} from '@/lib/mappers/hardware-mappers'
import { mapSessionFromDb } from '@/lib/mappers/domain-mappers'

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

  try {
    const detail = await hardwareAdminService.getHardwareDetail(id)
    if (!detail) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
    }

    const origin = appOrigin()

    return NextResponse.json({
      success: true,
      data: {
        hardware: mapAdminHardwareFromDb(detail.station, origin),
        slots: detail.station.slots.map(mapAdminSlotFromDb),
        activeSessions: detail.activeSessions.map((s) => mapSessionFromDb(s)),
        recentSessions: detail.recentSessions.map((s) => mapSessionFromDb(s)),
        auditLog: detail.auditLog.map(mapHardwareAuditEntry),
        maintenance: detail.maintenance,
        deletionBlockers: detail.deletionBlockers,
        qrUrl: detail.qrUrl,
      },
    })
  } catch (error) {
    console.error('[Admin] station detail:', error)
    return NextResponse.json({ success: false, error: 'Failed to load hardware detail' }, { status: 500 })
  }
}
