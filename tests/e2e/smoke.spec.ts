import { test, expect } from '@playwright/test'

test.describe('Launch smoke checks', () => {
  test('health API responds OK', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBeLessThan(500)
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('status')
      expect(body).toHaveProperty('timestamp')
    }
  })

  test('stations API responds OK', async ({ request }) => {
    const response = await request.get('/api/stations')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('stations')
  })

  test('static manifest is served', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect([200, 404]).toContain(response.status())
  })
})
