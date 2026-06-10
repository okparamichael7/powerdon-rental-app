import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { borrowResultLabel } from '@/lib/rental/borrow-result-label'
import { BorrowResult } from '@/lib/wscharge/protocol'

describe('borrowResultLabel', () => {
  it('describes cabinet failure in plain language', () => {
    assert.match(borrowResultLabel(BorrowResult.FAILURE), /refused eject/)
  })

  it('labels success', () => {
    assert.equal(borrowResultLabel(BorrowResult.SUCCESS), 'success')
  })
})
