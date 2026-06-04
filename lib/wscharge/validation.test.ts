import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wsChargeMessageBodySchema } from './validation'

describe('WsCharge request validation', () => {
  it('accepts valid messageHex', () => {
    const result = wsChargeMessageBodySchema.safeParse({
      messageHex: '0008600100112233440001',
    })
    assert.equal(result.success, true)
  })

  it('rejects non-hex messageHex', () => {
    const result = wsChargeMessageBodySchema.safeParse({
      messageHex: 'not-hex!',
    })
    assert.equal(result.success, false)
  })

  it('rejects missing messageHex', () => {
    const result = wsChargeMessageBodySchema.safeParse({})
    assert.equal(result.success, false)
  })
})
