import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canTransitionSession,
  canTransitionPayment,
  isTerminalSessionStatus,
  canReserveSlot,
  slotBlocksConcurrentStart,
} from '@/lib/rental/session-transitions'

describe('session-transitions (production module)', () => {
  it('pending → active on activate', () => {
    assert.equal(canTransitionSession('pending', 'activate'), 'active')
  })

  it('pending → cancelled on cancel', () => {
    assert.equal(canTransitionSession('pending', 'cancel'), 'cancelled')
  })

  it('pending → expired on expire', () => {
    assert.equal(canTransitionSession('pending', 'expire'), 'expired')
  })

  it('active → completed on complete', () => {
    assert.equal(canTransitionSession('active', 'complete'), 'completed')
  })

  it('blocks pending → complete', () => {
    assert.equal(canTransitionSession('pending', 'complete'), null)
  })

  it('completed is terminal', () => {
    assert.equal(isTerminalSessionStatus('completed'), true)
    assert.equal(canTransitionSession('completed', 'cancel'), null)
  })

  it('payment pending → authorized', () => {
    assert.equal(canTransitionPayment('pending', 'authorized'), true)
  })

  it('payment captured → refunded only', () => {
    assert.equal(canTransitionPayment('captured', 'refunded'), true)
    assert.equal(canTransitionPayment('captured', 'authorized'), false)
  })

  it('only occupied slots can be reserved', () => {
    assert.equal(canReserveSlot('occupied'), true)
    assert.equal(canReserveSlot('reserved'), false)
  })

  it('reserved slot blocks concurrent start', () => {
    assert.equal(slotBlocksConcurrentStart('reserved'), true)
  })
})
