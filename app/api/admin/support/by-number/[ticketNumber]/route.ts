import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { supportRepository } from '@/lib/db'
import { mapSupportTicketFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { ticketNumber } = await params
  const ticket = await supportRepository.getByNumber(ticketNumber)
  if (!ticket) {
    return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: mapSupportTicketFromDb(ticket) })
}
