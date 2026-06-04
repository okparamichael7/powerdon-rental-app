import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveStaffAccess } from '@/lib/security/staff-access'
import { staffRoleRepository } from '@/lib/db'
import { syncAuthStaffMetadata } from '@/lib/security/auth-metadata-sync'

/**
 * After sign-in: verify staff access (DB + metadata) and optionally bootstrap first admin.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return NextResponse.json({ isStaff: false }, { status: 401 })
  }

  let { role, source } = await resolveStaffAccess(user.id, {
    app_metadata: user.app_metadata as Record<string, unknown>,
    user_metadata: user.user_metadata as Record<string, unknown>,
  })

  if (!role) {
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
    const count = await staffRoleRepository.countActive()
    if (count === 0 && bootstrapEmail && user.email.toLowerCase() === bootstrapEmail) {
      await staffRoleRepository.grant({
        authUserId: user.id,
        email: user.email,
        role: 'admin',
        grantedBy: user.id,
        notes: 'Bootstrap via BOOTSTRAP_ADMIN_EMAIL',
      })
      await syncAuthStaffMetadata(user.id)
      role = 'admin'
      source = 'database'
    }
  }

  if (role && source === 'database') {
    await syncAuthStaffMetadata(user.id)
  }

  return NextResponse.json({
    isStaff: role !== null,
    role,
    source,
  })
}
