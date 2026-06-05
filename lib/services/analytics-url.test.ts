import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

function analyticsUrl(type: string, days = 30): string {
  return `/api/admin/analytics${buildQuery({ type, days })}`
}

describe('analyticsUrl', () => {
  it('uses ampersand separator for days (not a second question mark)', () => {
    const path = analyticsUrl('daily-revenue', 14)
    assert.equal(path, '/api/admin/analytics?type=daily-revenue&days=14')
    const params = new URL(`http://localhost${path}`).searchParams
    assert.equal(params.get('type'), 'daily-revenue')
    assert.equal(params.get('days'), '14')
  })

  it('covers all dated analytics types', () => {
    for (const type of ['revenue', 'sessions', 'rewards', 'hourly', 'duration', 'daily-revenue']) {
      const params = new URL(`http://localhost${analyticsUrl(type, 7)}`).searchParams
      assert.equal(params.get('type'), type)
      assert.equal(params.get('days'), '7')
    }
  })
})
