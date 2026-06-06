import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateStaffPassword } from '@/lib/security/staff-password'

describe('validateStaffPassword', () => {
  it('accepts a strong password', () => {
    assert.equal(validateStaffPassword('SecurePass123'), null)
  })

  it('rejects short passwords', () => {
    assert.match(validateStaffPassword('Short1a') ?? '', /at least/)
  })

  it('rejects missing uppercase', () => {
    assert.match(validateStaffPassword('alllowercase123') ?? '', /uppercase/)
  })

  it('rejects missing lowercase', () => {
    assert.match(validateStaffPassword('ALLUPPERCASE123') ?? '', /lowercase/)
  })

  it('rejects missing number', () => {
    assert.match(validateStaffPassword('NoNumbersHere') ?? '', /number/)
  })
})
