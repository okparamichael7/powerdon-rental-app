import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canDispatchHardwareToStation,
  shouldSkipBorrowDispatch,
} from '@/lib/rental/hardware-dispatch-guard'

describe('canDispatchHardwareToStation', () => {
  it('rejects stations without external_id', () => {
    const result = canDispatchHardwareToStation({
      id: 'station-1',
      external_id: null,
      status: 'online',
    })
    assert.equal(result.allowed, false)
  })
})

describe('shouldSkipBorrowDispatch', () => {
  it('skips when session is already active', () => {
    assert.equal(
      shouldSkipBorrowDispatch({ status: 'active' }, []),
      true,
    )
  })

  it('skips when pickup event exists', () => {
    assert.equal(
      shouldSkipBorrowDispatch(
        { status: 'pending' },
        [{ event_type: 'pickup' }],
      ),
      true,
    )
  })

  it('allows retry when only unlock event was logged', () => {
    assert.equal(
      shouldSkipBorrowDispatch(
        { status: 'pending' },
        [{ event_type: 'unlock' }],
      ),
      false,
    )
  })
})
