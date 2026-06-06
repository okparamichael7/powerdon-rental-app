import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getPermissionsForRole,
  hasPermission,
  permissionDeniedMessage,
} from '@/lib/security/permissions'
import type { AuthContext } from '@/lib/security/auth'

function auth(role: AuthContext['role'], isAdmin = role === 'admin'): AuthContext {
  return {
    userId: 'user-1',
    role,
    isAdmin,
    isService: role === 'service',
  }
}

describe('hardware permissions', () => {
  it('admin has full hardware permissions', () => {
    const perms = getPermissionsForRole('admin')
    assert.ok(perms.includes('hardware.create'))
    assert.ok(perms.includes('hardware.delete'))
    assert.ok(perms.includes('operations_hub.read'))
  })

  it('operator can read hardware and manage slots but not create/delete', () => {
    const perms = getPermissionsForRole('operator')
    assert.ok(perms.includes('hardware.read'))
    assert.ok(perms.includes('hardware.slot.manage'))
    assert.ok(!perms.includes('hardware.create'))
    assert.ok(!perms.includes('hardware.delete'))
    assert.ok(!perms.includes('hardware.archive'))
  })

  it('hasPermission enforces role matrix', () => {
    assert.equal(hasPermission(auth('admin'), 'hardware.create'), true)
    assert.equal(hasPermission(auth('operator'), 'hardware.create'), false)
    assert.equal(hasPermission(auth('operator'), 'hardware.read'), true)
    assert.equal(hasPermission(auth('user'), 'hardware.read'), false)
  })

  it('permissionDeniedMessage includes permission id', () => {
    assert.match(permissionDeniedMessage('hardware.delete'), /hardware\.delete/)
  })
})
