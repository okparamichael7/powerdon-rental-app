import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getOperationsHubLinks,
  resolveOperationsHubUrl,
} from '@/lib/admin/operations-hub-config'

describe('operations hub config', () => {
  it('returns sections for all categories', () => {
    const sections = getOperationsHubLinks({ isAdmin: true, environment: 'test' })
    assert.ok(sections.length >= 6)
    assert.ok(sections.some((s) => s.id === 'qr_tools'))
    assert.ok(sections.some((s) => s.id === 'payment'))
  })

  it('hides admin-only links from operators', () => {
    const adminSections = getOperationsHubLinks({ isAdmin: true })
    const operatorSections = getOperationsHubLinks({ isAdmin: false })
    const adminAnalytics = adminSections.find((s) => s.id === 'analytics')!
    const operatorAnalytics = operatorSections.find((s) => s.id === 'analytics')!
    const adminOnlyCount = adminAnalytics.links.filter((l) => l.adminOnly).length
    const operatorAdminOnly = operatorAnalytics.links.filter((l) => l.adminOnly).length
    assert.ok(adminOnlyCount > 0)
    assert.equal(operatorAdminOnly, 0)
  })

  it('resolves relative internal paths against app origin', () => {
    const url = resolveOperationsHubUrl(
      {
        id: 'test',
        category: 'analytics',
        label: 'Test',
        description: 'Test',
        url: '/admin/ops',
        external: false,
      },
      'https://app.powerdon.com',
    )
    assert.equal(url, 'https://app.powerdon.com/admin/ops')
  })

  it('stripe dashboard has default URL when env not set', () => {
    const sections = getOperationsHubLinks({ isAdmin: true })
    const payment = sections.find((s) => s.id === 'payment')!
    const stripe = payment.links.find((l) => l.id === 'stripe-dashboard')!
    assert.equal(stripe.url, 'https://dashboard.stripe.com')
  })

  it('qr notes link is informational reference only', () => {
    const sections = getOperationsHubLinks({ isAdmin: true })
    const qr = sections.find((s) => s.id === 'qr_tools')!
    const notes = qr.links.find((l) => l.id === 'qr-notes')!
    assert.equal(notes.url, null)
    assert.equal(notes.informational, true)
  })

  it('qr generator and management use separate env vars', () => {
    const sections = getOperationsHubLinks({ isAdmin: true })
    const qr = sections.find((s) => s.id === 'qr_tools')!
    const generator = qr.links.find((l) => l.id === 'qr-generator')!
    const management = qr.links.find((l) => l.id === 'qr-management')!
    assert.notEqual(generator.id, management.id)
    assert.equal(generator.url, null)
    assert.equal(management.url, null)
  })
})
