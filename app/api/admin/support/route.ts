import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { supportRepository } from '@/lib/db'
import { mapSupportTicketFromDb } from '@/lib/mappers/domain-mappers'
import type { SupportStatus } from '@/lib/db/types'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const statusParam = params.get('status')
  const tickets = await supportRepository.getAll({
    status: statusParam ? (statusParam.split(',') as SupportStatus[]) : undefined,
    userEmail: params.get('email') || undefined,
    limit: params.get('limit') ? Number(params.get('limit')) : 200,
  })

  return NextResponse.json({ success: true, data: tickets.map(mapSupportTicketFromDb) })
}
