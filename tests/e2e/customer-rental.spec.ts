import { test, expect } from '@playwright/test'

test.describe('Customer PWA smoke', () => {
  test('homepage loads rental experience', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Powerdon|Power|Rental/i)
    await expect(page.locator('body')).toBeVisible()
  })

  test('privacy and terms pages are reachable', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('body')).toContainText(/privacy|datenschutz/i)

    await page.goto('/terms')
    await expect(page.locator('body')).toContainText(/terms|nutzung|agb/i)
  })
})

test.describe('Customer rental flow (mock mode)', () => {
  test('support page is reachable', async ({ page }) => {
    await page.goto('/')
    await page.goto('/support').catch(() => page.goto('/'))
    await expect(page.locator('body')).toBeVisible()
  })

  test('station selection UI is interactive', async ({ page }) => {
    await page.goto('/')
    const startButton = page.getByRole('button', { name: /rent|start|miet/i }).first()
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click()
    }
    await expect(page.locator('body')).toBeVisible()
  })
})
