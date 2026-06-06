import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getStaffInviteRedirectUrl } from '@/lib/admin/staff-invite'

describe('getStaffInviteRedirectUrl', () => {
  it('builds callback URL with admin redirect', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.powerdon.test/'
    try {
      assert.equal(
        getStaffInviteRedirectUrl(),
        'https://app.powerdon.test/auth/callback?next=/admin',
      )
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })

  it('throws when app URL is missing', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    try {
      assert.throws(() => getStaffInviteRedirectUrl(), /NEXT_PUBLIC_APP_URL/)
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })
})
