import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { supportRepository } from '@/lib/db'
import { mapSupportTicketFromDb } from '@/lib/mappers/domain-mappers'
import type { SupportStatus } from '@/lib/db/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const ticket = await supportRepository.getById(id)
  if (!ticket) {
    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: mapSupportTicketFromDb(ticket) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()
  const ticket = await supportRepository.update(id, {
    status: body.status as SupportStatus | undefined,
    resolution: body.resolution,
    priority: body.priority,
  })
  return NextResponse.json({ success: true, data: mapSupportTicketFromDb(ticket) })
}
