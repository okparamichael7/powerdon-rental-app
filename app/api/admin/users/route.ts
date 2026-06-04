import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { userRepository } from '@/lib/db'
import { mapUserFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const users = await userRepository.getAll({
    search: params.get('search') || undefined,
    marketingConsent: params.get('marketingConsent') === 'true' ? true : undefined,
    limit: params.get('limit') ? Number(params.get('limit')) : 200,
  })
  return NextResponse.json({ success: true, data: users.map(mapUserFromDb) })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const user = await userRepository.create({
    email: body.email,
    name: body.name,
    phone: body.phone,
    marketingConsent: body.marketingConsent,
  })
  return NextResponse.json({ success: true, data: mapUserFromDb(user) }, { status: 201 })
}
