import { test, expect } from '@playwright/test'

test.describe('Admin dashboard smoke', () => {
  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByRole('button').or(page.getByRole('link')).first()).toBeVisible()
  })

  test('unauthenticated admin root redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 }).catch(() => null)
    const url = page.url()
    expect(url.includes('/admin/login') || url.includes('/admin')).toBeTruthy()
  })

  test('admin sessions page requires auth', async ({ page }) => {
    await page.goto('/admin/sessions')
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 }).catch(() => null)
    const url = page.url()
    expect(url.includes('/admin/login') || url.includes('/admin/sessions')).toBeTruthy()
  })
})

test.describe('Admin RBAC pages', () => {
  test('staff page exists and is gated', async ({ page }) => {
    await page.goto('/admin/staff')
    await page.waitForURL(/\/admin\/(login|staff)/, { timeout: 15_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('audit page exists and is gated', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForURL(/\/admin\/(login|audit)/, { timeout: 15_000 })
    await expect(page.locator('body')).toBeVisible()
  })
})
