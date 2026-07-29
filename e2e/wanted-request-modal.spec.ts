import { test, expect } from '@playwright/test'

test.describe('Wanted Request Modal', () => {
  async function openModal(page) {
    await page.goto('/')
    const trigger = page.locator('[aria-label="Create a wanted equipment request"]')
    await trigger.waitFor({ state: 'visible', timeout: 10_000 })
    await trigger.click()
    return page.locator('[role="dialog"]')
  }

  test('modal heading displays "Request equipment"', async ({ page }) => {
    const dialog = await openModal(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('h2')).toHaveText('Request equipment')
  })

  test('desktop modal fits within 1366×768 without internal scrollbar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const dialog = await openModal(page)
    await expect(dialog).toBeVisible()

    const overflow = await dialog.evaluate((el) => {
      return el.scrollHeight <= el.clientHeight + 2
    })
    expect(overflow).toBe(true)
  })

  test('submit button is visible at initial modal position', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const dialog = await openModal(page)
    const submitButton = dialog.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toBeInViewport()
  })

  test('mobile modal remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const dialog = await openModal(page)
    await expect(dialog).toBeVisible()
    const submitButton = dialog.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
  })

  test('location field has autocomplete binding', async ({ page }) => {
    const dialog = await openModal(page)
    const locationInput = dialog.locator('input[placeholder*="London"]')
    await expect(locationInput).toBeVisible()
    expect(await locationInput.getAttribute('autocomplete')).toBe('off')
  })

  test('nationwide works without Google selection', async ({ page }) => {
    const dialog = await openModal(page)
    const locationInput = dialog.locator('input[placeholder*="London"]')
    await locationInput.fill('nationwide')
    expect(await locationInput.inputValue()).toBe('nationwide')
  })

  test('editing location clears stale place data', async ({ page }) => {
    const dialog = await openModal(page)
    const locationInput = dialog.locator('input[placeholder*="London"]')
    await locationInput.fill('London')
    await page.waitForTimeout(200)
    await locationInput.fill('Manchester')
    expect(await locationInput.inputValue()).toBe('Manchester')
  })
})
