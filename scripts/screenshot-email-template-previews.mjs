#!/usr/bin/env node
/**
 * Screenshot Phase 2 transactional email previews (desktop + mobile).
 *
 * Usage:
 *   node scripts/build-email-master.mjs
 *   node scripts/screenshot-email-template-previews.mjs
 *   node scripts/screenshot-email-template-previews.mjs offer_received payment_successful
 */

import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { PHASE2_EMAIL_TEMPLATE_KEYS } from '../emails/templates/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'emails', 'dist')
const OUT_DIR = path.join(ROOT, 'debug-screenshots')
const PREVIEW_DIR = path.join(ROOT, 'emails', 'preview')

async function screenshotViewport(browser, previewPath, outPath, width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(pathToFileURL(previewPath).href, { waitUntil: 'load' })
  await page.locator('.email-logo--light').waitFor({ state: 'visible' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: outPath, fullPage: true })
  await page.close()
  return outPath
}

async function main() {
  const requestedKeys = process.argv.slice(2).filter(Boolean)
  const templateKeys =
    requestedKeys.length > 0
      ? requestedKeys.filter((key) => {
          if (!PHASE2_EMAIL_TEMPLATE_KEYS.includes(key)) {
            console.warn(`Skipping unknown template key: ${key}`)
            return false
          }
          return true
        })
      : PHASE2_EMAIL_TEMPLATE_KEYS

  if (templateKeys.length === 0) {
    console.error('No valid template keys to screenshot.')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(PREVIEW_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const saved = []

  try {
    for (const templateKey of templateKeys) {
      const previewPath = path.join(DIST_DIR, `preview-${templateKey}.html`)
      const desktopDebug = path.join(OUT_DIR, `email-${templateKey}-desktop.png`)
      const mobileDebug = path.join(OUT_DIR, `email-${templateKey}-mobile.png`)
      const desktopPreview = path.join(PREVIEW_DIR, `${templateKey}-desktop.png`)
      const mobilePreview = path.join(PREVIEW_DIR, `${templateKey}-mobile.png`)

      await screenshotViewport(browser, previewPath, desktopDebug, 1280, 900)
      await screenshotViewport(browser, previewPath, mobileDebug, 390, 844)
      await copyFile(desktopDebug, desktopPreview)
      await copyFile(mobileDebug, mobilePreview)

      saved.push(desktopPreview, mobilePreview)
      console.log(`Saved ${templateKey} previews:`)
      console.log(`  ${desktopPreview}`)
      console.log(`  ${mobilePreview}`)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${saved.length} preview images written under emails/preview/`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
