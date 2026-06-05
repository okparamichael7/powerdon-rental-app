import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { schemas, sanitizeString, sanitizeObject } from '@/lib/security/validation'
import { buildRentalStartPayload, buildSupportTicketPayload, buildGrantStaffPayload } from '../../fixtures/factories'
import { TEST_STATION_ID } from '../../helpers/env'

describe('rentalStartPublic schema', () => {
  it('accepts valid rental start payload', () => {
    const result = schemas.rentalStartPublic.safeParse(buildRentalStartPayload())
    assert.equal(result.success, true)
  })

  it('rejects invalid email', () => {
    const result = schemas.rentalStartPublic.safeParse(
      buildRentalStartPayload({ userEmail: 'not-an-email' }),
    )
    assert.equal(result.success, false)
  })

  it('rejects invalid station UUID', () => {
    const result = schemas.rentalStartPublic.safeParse(
      buildRentalStartPayload({ stationId: 'SIM001' }),
    )
    assert.equal(result.success, false)
  })

  it('rejects SQL injection in email field', () => {
    const result = schemas.rentalStartPublic.safeParse(
      buildRentalStartPayload({ userEmail: "test'; DROP TABLE users;--@evil.com" }),
    )
    assert.equal(result.success, false)
  })

  it('rejects out-of-range slot numbers', () => {
    const result = schemas.rentalStartPublic.safeParse(
      buildRentalStartPayload({ slotNumber: 99 }),
    )
    assert.equal(result.success, false)
  })
})

describe('supportTicket schema (honeypot + XSS payloads)', () => {
  it('accepts valid support ticket', () => {
    const result = schemas.supportTicket.safeParse(buildSupportTicketPayload())
    assert.equal(result.success, true)
  })

  it('rejects honeypot website field when filled (bot trap)', () => {
    const result = schemas.supportTicket.safeParse(
      buildSupportTicketPayload({ website: 'http://spam.com' }),
    )
    assert.equal(result.success, false)
  })

  it('accepts XSS payload in description (stored safely via sanitize layer)', () => {
    const xss = '<script>alert("xss")</script>'
    const result = schemas.supportTicket.safeParse(
      buildSupportTicketPayload({ description: xss.repeat(2) + ' extra text here.' }),
    )
    assert.equal(result.success, true)
    if (result.success) {
      const sanitized = sanitizeString(result.data.description)
      assert.ok(!sanitized.includes('<script>'))
      assert.ok(sanitized.includes('&lt;script&gt;'))
    }
  })

  it('rejects too-short description', () => {
    const result = schemas.supportTicket.safeParse(
      buildSupportTicketPayload({ description: 'short' }),
    )
    assert.equal(result.success, false)
  })
})

describe('grantStaffRole schema', () => {
  it('accepts operator grant', () => {
    const result = schemas.grantStaffRole.safeParse(buildGrantStaffPayload())
    assert.equal(result.success, true)
  })

  it('rejects invalid role (privilege escalation attempt)', () => {
    const result = schemas.grantStaffRole.safeParse(
      buildGrantStaffPayload({ role: 'superadmin' }),
    )
    assert.equal(result.success, false)
  })
})

describe('pagination schema', () => {
  it('defaults page and limit', () => {
    const result = schemas.pagination.safeParse({})
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.page, 1)
      assert.equal(result.data.limit, 20)
    }
  })

  it('caps limit at 100', () => {
    const result = schemas.pagination.safeParse({ limit: '500' })
    assert.equal(result.success, false)
  })
})

describe('sanitizeObject', () => {
  it('recursively sanitizes nested strings', () => {
    const input = { user: { name: '<img onerror=alert(1)>' }, tags: ['<b>'] }
    const out = sanitizeObject(input)
    assert.ok(!String(out.user.name).includes('<img'))
    assert.ok(String(out.tags[0]).includes('&lt;b&gt;'))
  })
})

describe('sessionCode schema', () => {
  it('accepts 8-char alphanumeric codes', () => {
    assert.equal(schemas.sessionCode.safeParse('AB12CD34').success, true)
  })

  it('rejects UUID as session code', () => {
    assert.equal(schemas.sessionCode.safeParse(TEST_STATION_ID.slice(0, 8)).success, false)
  })
})
