import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { userRepository } from '@/lib/db'
import { mapUserFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const user = await userRepository.getById(id)
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: mapUserFromDb(user) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()
  const user = await userRepository.update(id, {
    name: body.name,
    phone: body.phone,
    marketing_consent: body.marketingConsent,
  })
  return NextResponse.json({ success: true, data: mapUserFromDb(user) })
}
