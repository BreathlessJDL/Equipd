#!/usr/bin/env node
/**
 * Screenshot Equipd master email preview (desktop + mobile).
 *
 * Usage:
 *   node scripts/build-email-master.mjs
 *   node scripts/screenshot-email-master-preview.mjs
 */

import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PREVIEW_PATH = path.join(ROOT, 'emails', 'dist', 'master-preview.html')
const OUT_DIR = path.join(ROOT, 'debug-screenshots')
const PREVIEW_DIR = path.join(ROOT, 'emails', 'preview')

async function screenshotViewport(browser, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(pathToFileURL(PREVIEW_PATH).href, { waitUntil: 'load' })
  await page.locator('.email-logo--light').waitFor({ state: 'visible' })
  await page.waitForTimeout(200)

  const outPath = path.join(OUT_DIR, name)
  await page.screenshot({ path: outPath, fullPage: true })
  await page.close()
  return outPath
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(PREVIEW_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  try {
    const desktop = await screenshotViewport(
      browser,
      'email-master-preview-desktop.png',
      1280,
      900,
    )
    const mobile = await screenshotViewport(
      browser,
      'email-master-preview-mobile.png',
      390,
      844,
    )

    await copyFile(desktop, path.join(PREVIEW_DIR, 'master-preview-desktop.png'))
    await copyFile(mobile, path.join(PREVIEW_DIR, 'master-preview-mobile.png'))

    console.log('Saved preview screenshots:')
    console.log(`  ${desktop}`)
    console.log(`  ${mobile}`)
    console.log(`  ${path.join(PREVIEW_DIR, 'master-preview-desktop.png')}`)
    console.log(`  ${path.join(PREVIEW_DIR, 'master-preview-mobile.png')}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
