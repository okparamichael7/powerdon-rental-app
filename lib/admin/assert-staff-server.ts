import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { resolveStaffAccess } from '@/lib/security/staff-access'

export async function assertStaffSession(requireAdmin = false) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    throw new Error('Unauthorized')
  }

  const { role } = await resolveStaffAccess(user.id, {
    app_metadata: user.app_metadata as Record<string, unknown>,
    user_metadata: user.user_metadata as Record<string, unknown>,
  })

  if (!role) {
    throw new Error('Forbidden')
  }

  if (requireAdmin && role !== 'admin') {
    throw new Error('Admin role required')
  }

  return { user, role }
}
