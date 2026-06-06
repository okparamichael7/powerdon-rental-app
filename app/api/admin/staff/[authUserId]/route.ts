import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOnly } from '@/lib/api/route-helpers'
import { staffRoleRepository } from '@/lib/db'
import { staffAuditRepository } from '@/lib/db/staff-audit-repository'
import { syncAuthStaffMetadata } from '@/lib/security/auth-metadata-sync'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ authUserId: string }> },
) {
  const auth = await requireAdminOnly(_request)
  if (!auth.ok) return auth.response

  const { authUserId } = await params

  if (authUserId === auth.auth.userId) {
    return NextResponse.json(
      { success: false, error: 'You cannot revoke your own staff access.' },
      { status: 400 },
    )
  }

  const active = await staffRoleRepository.getActiveRole(authUserId)
  if (!active) {
    return NextResponse.json(
      { success: false, error: 'User has no active staff role.' },
      { status: 404 },
    )
  }

  if (active === 'admin') {
    const adminCount = await staffRoleRepository.countActiveByRole('admin')
    if (adminCount <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot revoke the last active admin. Grant another admin first.',
          code: 'LAST_ADMIN',
        },
        { status: 409 },
      )
    }
  }

  await staffRoleRepository.revoke(authUserId, auth.auth.userId)
  await staffAuditRepository.log({
    actorAuthUserId: auth.auth.userId,
    targetAuthUserId: authUserId,
    action: 'revoke',
    role: active,
    details: {},
  })
  await syncAuthStaffMetadata(authUserId)

  return NextResponse.json({ success: true })
}
