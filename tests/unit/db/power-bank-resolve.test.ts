import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPowerBankUuid,
  normalizeTerminalExternalId,
} from '@/lib/db/power-bank-resolve'

describe('normalizeTerminalExternalId', () => {
  it('uppercases WsCharge terminal hex', () => {
    assert.equal(
      normalizeTerminalExternalId('57534b4356250182'),
      '57534B4356250182',
    )
  })

  it('rejects empty terminal ids', () => {
    assert.equal(normalizeTerminalExternalId('0000000000000000'), null)
  })
})

describe('isPowerBankUuid', () => {
  it('rejects terminal hex as UUID', () => {
    assert.equal(isPowerBankUuid('57534B4356250182'), false)
  })

  it('accepts postgres UUID', () => {
    assert.equal(
      isPowerBankUuid('11111111-1111-1111-1111-111111111111'),
      true,
    )
  })
})
