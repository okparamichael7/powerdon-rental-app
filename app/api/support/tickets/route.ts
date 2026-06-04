import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api/route-helpers'
import { supportRepository } from '@/lib/db'
import { validateBody, schemas } from '@/lib/security/validation'

export async function POST(request: NextRequest) {
  const rateLimited = await enforceRateLimit(request, 'api')
  if (rateLimited) return rateLimited

  const validated = await validateBody(request, schemas.supportTicket)
  if (!validated.success) return validated.error

  const body = validated.data
  if (body.website) {
    return NextResponse.json({ success: false, error: 'Rejected' }, { status: 400 })
  }

  try {
    const ticket = await supportRepository.create({
      email: body.email,
      sessionId: body.sessionId,
      category: body.category,
      subject: body.subject,
      description: body.description,
      priority: body.priority,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status,
        subject: ticket.subject,
        createdAt: ticket.created_at,
      },
    })
  } catch (error) {
    console.error('[Support] create ticket:', error)
    return NextResponse.json({ success: false, error: 'Failed to create ticket' }, { status: 500 })
  }
}
