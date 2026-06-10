import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isStationUuid } from './station-resolve'

describe('station-resolve', () => {
  it('recognizes UUID station ids', () => {
    assert.equal(isStationUuid('60f55779-1b62-4b79-b6fc-178d9086a8ab'), true)
  })

  it('rejects WsCharge product serial numbers', () => {
    assert.equal(isStationUuid('5753424156100007'), false)
  })

  it('rejects blank values', () => {
    assert.equal(isStationUuid(''), false)
    assert.equal(isStationUuid('   '), false)
  })
})
