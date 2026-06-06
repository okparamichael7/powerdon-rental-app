import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { slotRemovalBlockers } from '@/lib/admin/slot-safety'

describe('slotRemovalBlockers', () => {
  it('blocks reserved slots', () => {
    const blockers = slotRemovalBlockers({
      slot: { slot_number: 3, status: 'reserved', power_bank_id: null },
      activeRentals: 0,
      historicalRentals: 0,
    })
    assert.equal(blockers.length, 1)
    assert.match(blockers[0], /reserved/)
  })

  it('blocks occupied slots with power bank', () => {
    const blockers = slotRemovalBlockers({
      slot: { slot_number: 2, status: 'occupied', power_bank_id: 'pb-1' },
      activeRentals: 0,
      historicalRentals: 0,
    })
    assert.ok(blockers.some((b) => b.includes('power bank')))
  })

  it('blocks slots with active rentals', () => {
    const blockers = slotRemovalBlockers({
      slot: { slot_number: 1, status: 'empty', power_bank_id: null },
      activeRentals: 2,
      historicalRentals: 0,
    })
    assert.ok(blockers.some((b) => b.includes('active rental')))
  })

  it('blocks slots with historical rentals', () => {
    const blockers = slotRemovalBlockers({
      slot: { slot_number: 4, status: 'empty', power_bank_id: null },
      activeRentals: 0,
      historicalRentals: 5,
    })
    assert.ok(blockers.some((b) => b.includes('historical')))
  })

  it('allows safe empty slots with no history', () => {
    const blockers = slotRemovalBlockers({
      slot: { slot_number: 5, status: 'empty', power_bank_id: null },
      activeRentals: 0,
      historicalRentals: 0,
    })
    assert.equal(blockers.length, 0)
  })
})
