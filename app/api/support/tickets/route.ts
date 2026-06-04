import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api/route-helpers'
import { supportRepository } from '@/lib/db'

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, 'api')
  if (rateLimited) return rateLimited

  try {
    const body = await request.json()
    if (!body.email || !body.subject || !body.description || !body.category) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

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
