import { NextRequest, NextResponse } from 'next/server'
import { sessionRepository } from '@/lib/db'
import { finalizeRentalPaymentOnReturn } from '@/lib/rental/finalize-payment'
import { verifyApiKey } from '@/lib/security/auth'

function isInternalServiceRequest(request: NextRequest): boolean {
  const auth = verifyApiKey(request)
  if (auth?.isService) return true

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const keys = [
    process.env.INTERNAL_API_KEY,
    process.env.TCP_PROXY_API_KEY,
    process.env.STATION_PROXY_TOKEN,
  ].filter(Boolean)
  return Boolean(bearer && keys.includes(bearer))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isInternalServiceRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const session = await sessionRepository.getById(id)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const durationMinutes = Number(body.durationMinutes ?? session.duration_minutes ?? 0)

  if (!session.payment_intent_id) {
    return NextResponse.json({
      chargedAmount: session.amount_charged ?? 0,
      refundedAmount: session.amount_refunded ?? session.deposit_amount,
    })
  }

  const result = await finalizeRentalPaymentOnReturn(session, durationMinutes)
  const chargedAmount = result.chargedCents / 100
  const refundedAmount = Math.max(0, session.deposit_amount - chargedAmount)

  return NextResponse.json({
    success: true,
    chargedAmount,
    refundedAmount,
    paymentStatus: result.paymentStatus,
  })
}
