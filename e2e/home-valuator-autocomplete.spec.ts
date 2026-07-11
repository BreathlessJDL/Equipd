import { test, expect } from '@playwright/test'

test.describe('homepage equipment valuator autocomplete', () => {
  test('selected suggestion opens details step with product preselected', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.home-valuator')).toBeVisible()

    const input = page.locator('#home-valuator-search')
    await input.click()
    await input.fill('Life Fitness 95T')

    const options = page.locator('.canonical-autocomplete__option')
    await expect(options.first()).toBeVisible({ timeout: 15000 })
    expect(await options.count()).toBeLessThanOrEqual(6)

    const selectedTitle = (
      await options.first().locator('.canonical-autocomplete__option-title').textContent()
    )?.trim()

    await options.first().dispatchEvent('mousedown')
    await page.waitForURL(/\/valuation\?product=.+&step=details/)

    await expect(page.getByRole('heading', { name: 'Equipment details' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('heading', { name: 'Select product' })).toHaveCount(0)
    await expect(page.locator('.valuation-page__selected-model strong')).toContainText(selectedTitle || 'Life Fitness')
    await expect(page.locator('#valuation-product-search')).toHaveCount(0)
  })

  test('typed query opens search step without auto-selecting', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('#home-valuator-search')
    await input.fill('Life Fitness treadmill')
    await page.locator('.home-valuator__submit').click()
    await page.waitForURL(/\/valuation\?q=Life(%20|\+)Fitness(%20|\+)treadmill/)
    await expect(page.getByRole('heading', { name: 'Select product' })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('#valuation-product-search')).toHaveValue(/Life Fitness treadmill/i)
    await expect(page.getByRole('heading', { name: 'Equipment details' })).toHaveCount(0)
  })

  test('empty submit opens normal valuation start page', async ({ page }) => {
    await page.goto('/')
    await page.locator('.home-valuator__submit').click()
    await page.waitForURL(/\/valuation\/?$/)
    await expect(page.getByRole('heading', { name: 'Select product' })).toBeVisible({ timeout: 20000 })
  })

  test('direct product URL survives refresh on details step', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('#home-valuator-search')
    await input.click()
    await input.fill('Matrix Performance Plus Treadmill')
    const options = page.locator('.canonical-autocomplete__option')
    await expect(options.first()).toBeVisible({ timeout: 15000 })
    await options.first().dispatchEvent('mousedown')
    await page.waitForURL(/\/valuation\?product=.+&step=details/)
    await expect(page.getByRole('heading', { name: 'Equipment details' })).toBeVisible({ timeout: 20000 })
    const selectedName = await page.locator('.valuation-page__selected-model strong').textContent()
    const url = page.url()

    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { name: 'Equipment details' })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.valuation-page__selected-model strong')).toHaveText(selectedName || '')
  })

  test('invalid product key falls back safely', async ({ page }) => {
    await page.goto('/valuation?product=not-a-real-product-key-xyz&step=details')
    await expect(page.getByRole('heading', { name: 'Select product' })).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.valuation-page__error')).toBeVisible()
  })

  test('browser back returns to homepage after suggestion select', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('#home-valuator-search')
    await input.click()
    await input.fill('Life Fitness 95T')
    const options = page.locator('.canonical-autocomplete__option')
    await expect(options.first()).toBeVisible({ timeout: 15000 })
    await options.first().dispatchEvent('mousedown')
    await page.waitForURL(/\/valuation\?product=/)
    await expect(page.getByRole('heading', { name: 'Equipment details' })).toBeVisible({ timeout: 20000 })

    await page.goBack()
    await expect(page).toHaveURL(/\/$|\/\?/)
    await expect(page.locator('.home-valuator')).toBeVisible()
  })

  test('shows no-results secondary action', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('#home-valuator-search')
    await input.fill('zzzz-no-match-equipd-xyz')
    await expect(page.locator('.canonical-autocomplete__empty')).toBeVisible({ timeout: 15000 })
    await page.locator('.canonical-autocomplete__empty-action').click()
    await page.waitForURL(/\/valuation\?q=zzzz-no-match-equipd-xyz/)
  })
})
