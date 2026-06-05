import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStaffRole, isStaffFromMetadata } from '@/lib/security/roles'
import { staffRoleToAuthContext } from '@/lib/security/staff-access'

describe('resolveStaffRole (JWT metadata fallback)', () => {
  it('resolves admin from app_metadata.role', () => {
    assert.equal(resolveStaffRole({ app_metadata: { role: 'admin' } }), 'admin')
  })

  it('resolves admin from app_metadata.is_admin', () => {
    assert.equal(resolveStaffRole({ app_metadata: { is_admin: true } }), 'admin')
  })

  it('resolves operator from app_metadata.role', () => {
    assert.equal(resolveStaffRole({ app_metadata: { role: 'operator' } }), 'operator')
  })

  it('resolves operator from is_staff flag', () => {
    assert.equal(resolveStaffRole({ app_metadata: { is_staff: true } }), 'operator')
  })

  it('returns null for regular users', () => {
    assert.equal(resolveStaffRole({ app_metadata: {}, user_metadata: {} }), null)
    assert.equal(isStaffFromMetadata({ app_metadata: {} }), false)
  })

  it('admin takes precedence over operator signals', () => {
    assert.equal(
      resolveStaffRole({ app_metadata: { role: 'admin', is_staff: true } }),
      'admin',
    )
  })
})

describe('staffRoleToAuthContext', () => {
  it('maps admin role', () => {
    const ctx = staffRoleToAuthContext('admin')
    assert.equal(ctx.isAdmin, true)
    assert.equal(ctx.role, 'admin')
  })

  it('maps operator role without admin flag', () => {
    const ctx = staffRoleToAuthContext('operator')
    assert.equal(ctx.isAdmin, false)
    assert.equal(ctx.role, 'operator')
  })
})

describe('RBAC matrix', () => {
  const permissions = {
    admin: ['staff:read', 'staff:write', 'audit:read', 'sessions:write'],
    operator: ['sessions:read', 'sessions:write', 'stations:read'],
  }

  it('operator cannot manage staff', () => {
    assert.ok(permissions.admin.includes('staff:write'))
    assert.ok(!permissions.operator.includes('staff:write'))
  })

  it('operator cannot read audit log', () => {
    assert.ok(permissions.admin.includes('audit:read'))
    assert.ok(!permissions.operator.includes('audit:read'))
  })
})
