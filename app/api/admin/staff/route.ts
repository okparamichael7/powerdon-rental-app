import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOnly } from '@/lib/api/route-helpers'
import { staffRoleRepository } from '@/lib/db'
import { staffAuditRepository } from '@/lib/db/staff-audit-repository'
import {
  staffProvisioningService,
  StaffProvisioningError,
} from '@/lib/admin/staff-provisioning-service'
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
      details: a.details,
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

  const validated = await validateBody(request, schemas.createStaffMember)
  if (!validated.success) return validated.error

  try {
    const result = await staffProvisioningService.provision(auth.auth.userId, {
      email: validated.data.email,
      provisionMethod: validated.data.provisionMethod,
      password: validated.data.password,
      role: validated.data.role,
      notes: validated.data.notes,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          authUserId: result.authUserId,
          email: result.email,
          role: result.role,
          grantedAt: result.grantedAt,
          provisionMethod: result.provisionMethod,
          authUserCreated: result.authUserCreated,
          passwordUpdated: result.passwordUpdated,
          inviteSent: result.inviteSent,
          existingAccountLinked: result.existingAccountLinked,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof StaffProvisioningError) {
      const status =
        error.code === 'ALREADY_STAFF'
          ? 409
          : error.code === 'AUTH_CREATE_FAILED' ||
              error.code === 'PASSWORD_UPDATE_FAILED' ||
              error.code === 'INVITE_FAILED'
            ? 502
            : error.code === 'INVITE_CONFIG'
              ? 503
              : 400
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status },
      )
    }
    console.error('[Admin] staff provision:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to provision staff member' },
      { status: 500 },
    )
  }
}
