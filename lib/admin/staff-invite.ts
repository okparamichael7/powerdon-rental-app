import type { SupabaseClient } from '@supabase/supabase-js'
import { staffRoleRepository } from '@/lib/db/staff-role-repository'
import { logger } from '@/lib/observability/logger'

export function getStaffInviteRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is required to send staff invite emails')
  }
  return `${base}/auth/callback?next=/admin`
}

export interface StaffInviteAuthResult {
  authUserId: string
  authUserCreated: boolean
  inviteSent: boolean
  existingAccountLinked: boolean
}

function isDuplicateAuthEmailError(error: { message?: string; status?: number }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.status === 422 ||
    msg.includes('already been registered') ||
    msg.includes('already exists') ||
    msg.includes('duplicate')
  )
}

/**
 * Sends a Supabase Auth invite for new staff, or links an existing auth user.
 * New users receive Supabase's invite email (configure SMTP in Supabase Auth settings).
 */
export async function resolveAuthUserForStaffInvite(
  supabase: SupabaseClient,
  email: string,
): Promise<StaffInviteAuthResult> {
  const redirectTo = getStaffInviteRedirectUrl()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  })

  if (!error && data.user?.id) {
    return {
      authUserId: data.user.id,
      authUserCreated: true,
      inviteSent: true,
      existingAccountLinked: false,
    }
  }

  if (!isDuplicateAuthEmailError(error ?? {})) {
    throw error ?? new Error('Failed to send staff invite')
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  })

  const existing = await staffRoleRepository.findAuthUserByEmail(email)
  if (!existing?.id) {
    throw new Error(
      'An auth account exists for this email but could not be resolved. Try again or use password provisioning.',
    )
  }

  if (linkError || !linkData.user?.id) {
    logger.warn('Staff invite: existing auth user; Supabase invite email not resent', {
      email,
      error: linkError?.message ?? error?.message,
    })
    return {
      authUserId: existing.id,
      authUserCreated: false,
      inviteSent: false,
      existingAccountLinked: true,
    }
  }

  return {
    authUserId: linkData.user.id,
    authUserCreated: false,
    inviteSent: false,
    existingAccountLinked: true,
  }
}
