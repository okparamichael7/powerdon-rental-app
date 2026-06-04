import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOnly, requireAdminSession } from '@/lib/api/route-helpers'
import { staffRoleRepository } from '@/lib/db'
import { staffAuditRepository } from '@/lib/db/staff-audit-repository'
import { syncAuthStaffMetadata } from '@/lib/security/auth-metadata-sync'
import { validateBody, schemas } from '@/lib/security/validation'

export async function GET(request: NextRequest) {
  const auth = await requireAdminOnly(request)
  if (!auth.ok) return auth.response

  const [staff, audit] = await Promise.all([
    staffRoleRepository.listActive(),
    staffAuditRepository.listRecent(30),
  ])
  return NextResponse.json({
    success: true,
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      role: a.role,
      targetAuthUserId: a.target_auth_user_id,
      actorAuthUserId: a.actor_auth_user_id,
      createdAt: a.created_at,
    })),
    data: staff.map((row) => ({
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email,
      role: row.role,
      grantedAt: row.granted_at,
      grantedBy: row.granted_by,
      notes: row.notes,
    })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOnly(request)
  if (!auth.ok) return auth.response

  const validated = await validateBody(request, schemas.grantStaffRole)
  if (!validated.success) return validated.error

  const authUser = await staffRoleRepository.findAuthUserByEmail(validated.data.email)
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: 'No Supabase Auth user with this email. Create the user under Authentication → Users first.',
      },
      { status: 404 },
    )
  }

  const row = await staffRoleRepository.grant({
    authUserId: authUser.id,
    email: authUser.email,
    role: validated.data.role,
    grantedBy: auth.auth.userId,
    notes: validated.data.notes,
  })

  await staffAuditRepository.log({
    actorAuthUserId: auth.auth.userId,
    targetAuthUserId: authUser.id,
    action: 'grant',
    role: validated.data.role,
    details: { email: authUser.email },
  })

  await syncAuthStaffMetadata(authUser.id)

  return NextResponse.json(
    {
      success: true,
      data: {
        id: row.id,
        authUserId: row.auth_user_id,
        email: row.email,
        role: row.role,
        grantedAt: row.granted_at,
      },
    },
    { status: 201 },
  )
}
