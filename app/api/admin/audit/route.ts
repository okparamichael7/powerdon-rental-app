import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOnly } from '@/lib/api/route-helpers'
import { staffAuditRepository } from '@/lib/db/staff-audit-repository'

export async function GET(request: NextRequest) {
  const auth = await requireAdminOnly(request)
  if (!auth.ok) return auth.response

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 200)

  const audit = await staffAuditRepository.listRecent(limit)
  return NextResponse.json({
    success: true,
    data: audit.map((a) => ({
      id: a.id,
      action: a.action,
      role: a.role,
      targetAuthUserId: a.target_auth_user_id,
      actorAuthUserId: a.actor_auth_user_id,
      details: a.details,
      createdAt: a.created_at,
    })),
  })
}
