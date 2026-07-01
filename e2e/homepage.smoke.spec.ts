import { test, expect } from '@playwright/test'

test.describe('Homepage smoke', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Equipd — Used Gym Equipment')
    await expect(page.getByLabel('Equipd hero banner')).toBeVisible()
  })
})
