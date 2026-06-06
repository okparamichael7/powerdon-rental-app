import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapPaymentIntentsToRecentTransactions } from '@/lib/billing/recent-transactions'
import { getPaginationRange } from '@/hooks/use-admin-pagination'

describe('mapPaymentIntentsToRecentTransactions', () => {
  it('maps and sorts by createdAt descending', () => {
    const rows = mapPaymentIntentsToRecentTransactions([
      {
        id: 'pi_old',
        amount: 1000,
        amount_received: 1000,
        created: 1_700_000_000,
        status: 'succeeded',
        metadata: { session_id: 'OLD12345', type: 'rental_deposit' },
        receipt_email: 'old@example.com',
      },
      {
        id: 'pi_new',
        amount: 2000,
        amount_received: 2000,
        created: 1_800_000_000,
        status: 'requires_capture',
        metadata: { session_id: 'NEW12345', type: 'rental_charge' },
        receipt_email: 'new@example.com',
      },
    ] as never)

    assert.equal(rows.length, 2)
    assert.equal(rows[0].id, 'pi_new')
    assert.equal(rows[1].id, 'pi_old')
    assert.equal(rows[0].sessionCode, 'NEW12345')
    assert.equal(rows[0].type, 'rental_charge')
  })

  it('falls back when metadata and email are missing', () => {
    const [row] = mapPaymentIntentsToRecentTransactions([
      {
        id: 'pi_min',
        amount: 500,
        amount_received: 0,
        created: 1_750_000_000,
        status: 'canceled',
        metadata: {},
        receipt_email: null,
      },
    ] as never)

    assert.equal(row.sessionCode, 'N/A')
    assert.equal(row.customerEmail, 'N/A')
    assert.equal(row.amount, 500)
    assert.equal(row.type, 'rental_deposit')
  })
})

describe('billing transactions pagination range', () => {
  it('computes page slices for admin table', () => {
    assert.deepEqual(getPaginationRange(1, 25, 60), { from: 1, to: 25, totalPages: 3 })
    assert.deepEqual(getPaginationRange(3, 25, 60), { from: 51, to: 60, totalPages: 3 })
  })
})
