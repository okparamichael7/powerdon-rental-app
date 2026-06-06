import { createServiceClient } from '@/lib/supabase/admin'
import { staffRoleRepository, type StaffRoleType } from '@/lib/db/staff-role-repository'
import { staffAuditRepository } from '@/lib/db/staff-audit-repository'
import { syncAuthStaffMetadata } from '@/lib/security/auth-metadata-sync'
import { resolveAuthUserForStaffInvite } from '@/lib/admin/staff-invite'

export type StaffProvisionMethod = 'password' | 'invite'

export interface ProvisionStaffInput {
  email: string
  role: StaffRoleType
  notes?: string
  provisionMethod: StaffProvisionMethod
  password?: string
}

export interface ProvisionStaffResult {
  id: string
  authUserId: string
  email: string
  role: StaffRoleType
  grantedAt: string
  provisionMethod: StaffProvisionMethod
  authUserCreated: boolean
  passwordUpdated: boolean
  inviteSent: boolean
  existingAccountLinked: boolean
}

export class StaffProvisioningError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'StaffProvisioningError'
  }
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

export class StaffProvisioningService {
  async provision(actorAuthUserId: string, input: ProvisionStaffInput): Promise<ProvisionStaffResult> {
    if (input.provisionMethod === 'invite') {
      return this.provisionWithInvite(actorAuthUserId, input)
    }
    return this.provisionWithPassword(actorAuthUserId, input)
  }

  private async assertNotActiveStaff(authUserId: string): Promise<void> {
    const activeRole = await staffRoleRepository.getActiveRole(authUserId)
    if (activeRole) {
      throw new StaffProvisioningError(
        'ALREADY_STAFF',
        'This email already has active staff access. Revoke first to re-provision.',
      )
    }
  }

  private async finalizeGrant(
    actorAuthUserId: string,
    input: {
      authUserId: string
      email: string
      role: StaffRoleType
      notes?: string
      provisionMethod: StaffProvisionMethod
      authUserCreated: boolean
      passwordUpdated: boolean
      inviteSent: boolean
      existingAccountLinked: boolean
    },
  ): Promise<ProvisionStaffResult> {
    const email = input.email.trim().toLowerCase()

    const row = await staffRoleRepository.grant({
      authUserId: input.authUserId,
      email,
      role: input.role,
      grantedBy: actorAuthUserId,
      notes: input.notes,
    })

    await staffAuditRepository.log({
      actorAuthUserId: actorAuthUserId,
      targetAuthUserId: input.authUserId,
      action: 'grant',
      role: input.role,
      details: {
        email,
        provisionMethod: input.provisionMethod,
        authUserCreated: input.authUserCreated,
        passwordUpdated: input.passwordUpdated,
        inviteSent: input.inviteSent,
        existingAccountLinked: input.existingAccountLinked,
        provisionedFromDashboard: true,
      },
    })

    await syncAuthStaffMetadata(input.authUserId)

    return {
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email,
      role: row.role,
      grantedAt: row.granted_at,
      provisionMethod: input.provisionMethod,
      authUserCreated: input.authUserCreated,
      passwordUpdated: input.passwordUpdated,
      inviteSent: input.inviteSent,
      existingAccountLinked: input.existingAccountLinked,
    }
  }

  private async provisionWithPassword(
    actorAuthUserId: string,
    input: ProvisionStaffInput,
  ): Promise<ProvisionStaffResult> {
    const password = input.password
    if (!password) {
      throw new StaffProvisioningError('PASSWORD_REQUIRED', 'Password is required for password provisioning')
    }

    const email = input.email.trim().toLowerCase()
    const supabase = await createServiceClient()

    let authUserId: string
    let authUserCreated = false
    let passwordUpdated = false

    const existing = await staffRoleRepository.findAuthUserByEmail(email)

    if (existing) {
      await this.assertNotActiveStaff(existing.id)

      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
      })
      if (updateError) {
        throw new StaffProvisioningError('PASSWORD_UPDATE_FAILED', updateError.message)
      }

      authUserId = existing.id
      passwordUpdated = true
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (error) {
        if (isDuplicateAuthEmailError(error)) {
          const retry = await staffRoleRepository.findAuthUserByEmail(email)
          if (!retry) {
            throw new StaffProvisioningError(
              'AUTH_USER_EXISTS',
              'An auth account exists for this email but could not be resolved. Try again or use Supabase dashboard.',
            )
          }
          await this.assertNotActiveStaff(retry.id)
          const { error: updateError } = await supabase.auth.admin.updateUserById(retry.id, {
            password,
          })
          if (updateError) {
            throw new StaffProvisioningError('PASSWORD_UPDATE_FAILED', updateError.message)
          }
          authUserId = retry.id
          passwordUpdated = true
        } else {
          throw new StaffProvisioningError('AUTH_CREATE_FAILED', error.message)
        }
      } else if (!data.user?.id || !data.user.email) {
        throw new StaffProvisioningError('AUTH_CREATE_FAILED', 'Auth user was not returned after creation')
      } else {
        authUserId = data.user.id
        authUserCreated = true
      }
    }

    return this.finalizeGrant(actorAuthUserId, {
      authUserId,
      email,
      role: input.role,
      notes: input.notes,
      provisionMethod: 'password',
      authUserCreated,
      passwordUpdated,
      inviteSent: false,
      existingAccountLinked: false,
    })
  }

  private async provisionWithInvite(
    actorAuthUserId: string,
    input: ProvisionStaffInput,
  ): Promise<ProvisionStaffResult> {
    const email = input.email.trim().toLowerCase()
    const supabase = await createServiceClient()

    let inviteResult: Awaited<ReturnType<typeof resolveAuthUserForStaffInvite>>
    try {
      inviteResult = await resolveAuthUserForStaffInvite(supabase, email)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send staff invite'
      if (message.includes('NEXT_PUBLIC_APP_URL')) {
        throw new StaffProvisioningError('INVITE_CONFIG', message)
      }
      throw new StaffProvisioningError('INVITE_FAILED', message)
    }

    await this.assertNotActiveStaff(inviteResult.authUserId)

    return this.finalizeGrant(actorAuthUserId, {
      authUserId: inviteResult.authUserId,
      email,
      role: input.role,
      notes: input.notes,
      provisionMethod: 'invite',
      authUserCreated: inviteResult.authUserCreated,
      passwordUpdated: false,
      inviteSent: inviteResult.inviteSent,
      existingAccountLinked: inviteResult.existingAccountLinked,
    })
  }
}

export const staffProvisioningService = new StaffProvisioningService()
