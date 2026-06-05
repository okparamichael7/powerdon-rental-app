import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canTransitionSession,
  canTransitionPayment,
  canReserveSlot,
  slotBlocksConcurrentStart,
} from '@/lib/rental/session-transitions'

describe('rental session lifecycle', () => {
  it('pending → active on successful borrow', () => {
    assert.equal(canTransitionSession('pending', 'activate'), 'active')
  })

  it('pending → cancelled on user cancel', () => {
    assert.equal(canTransitionSession('pending', 'cancel'), 'cancelled')
  })

  it('pending → expired on checkout timeout', () => {
    assert.equal(canTransitionSession('pending', 'expire'), 'expired')
  })

  it('active → completed on return finalize', () => {
    assert.equal(canTransitionSession('active', 'complete'), 'completed')
  })

  it('active stays active on extension', () => {
    assert.equal(canTransitionSession('active', 'extend'), 'active')
  })

  it('completed is terminal', () => {
    assert.equal(canTransitionSession('completed', 'cancel'), null)
  })

  it('prevents illegal pending → completed jump', () => {
    assert.equal(canTransitionSession('pending', 'complete'), null)
  })
})

describe('payment status lifecycle', () => {
  it('allows pending → authorized', () => {
    assert.equal(canTransitionPayment('pending', 'authorized'), true)
  })

  it('allows authorized → captured', () => {
    assert.equal(canTransitionPayment('authorized', 'captured'), true)
  })

  it('allows captured → refunded', () => {
    assert.equal(canTransitionPayment('captured', 'refunded'), true)
  })

  it('blocks captured → authorized (no rollback)', () => {
    assert.equal(canTransitionPayment('captured', 'authorized'), false)
  })

  it('blocks refunded → captured', () => {
    assert.equal(canTransitionPayment('refunded', 'captured'), false)
  })
})

describe('double-booking prevention rules', () => {
  it('slot must be occupied before reserve', () => {
    assert.equal(canReserveSlot('occupied'), true)
    assert.equal(canReserveSlot('empty'), false)
  })

  it('reserved slot blocks concurrent rental start', () => {
    assert.equal(slotBlocksConcurrentStart('reserved'), true)
    assert.equal(slotBlocksConcurrentStart('occupied'), false)
  })
})
