#!/usr/bin/env node
/**
 * Browser-level diagnostics for Create Listing Google Places autocomplete
 * after failed publish validation.
 *
 * Usage:
 *   node scripts/debug-create-listing-places.mjs [baseUrl]
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const baseUrl = process.argv[2] ?? 'http://localhost:5174/'
const DEV_PASSWORD = 'EquipdDevSeed123!'
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'
const LOCATION_INPUT_ID = 'listing-location'
const SEARCH_TERM = 'Leeds'

function loadEnvFile(relativePath) {
  const envPath = path.join(ROOT, relativePath)
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function getStorageKey(supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

async function createAuthenticatedContext(browser, supabaseUrl, anonKey) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  })

  if (error) throw new Error(`Dev login failed: ${error.message}`)

  const storageKey = getStorageKey(supabaseUrl)
  const sessionPayload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  }

  const context = await browser.newContext()
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(sessionPayload) },
  )

  return context
}

async function inspectPlacesState(page, label) {
  return page.evaluate(
    ({ inputId, searchTerm, stateLabel }) => {
      const input = document.getElementById(inputId)
      const pacContainers = [...document.querySelectorAll('.pac-container')]
      const active = document.activeElement

      function readStyle(el) {
        if (!el) return null
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          zIndex: cs.zIndex,
          pointerEvents: cs.pointerEvents,
          position: cs.position,
          overflow: cs.overflow,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
          className: el.className,
          childCount: el.childElementCount,
          hiddenClass: el.classList.contains('equipd-pac-hidden'),
        }
      }

      function isVisible(el) {
        if (!el) return false
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return (
          cs.display !== 'none'
          && cs.visibility !== 'hidden'
          && Number(cs.opacity) > 0
          && rect.width > 0
          && rect.height > 0
        )
      }

      const inputStyle = readStyle(input)
      const pacDetails = pacContainers.map((container, index) => ({
        index,
        ...readStyle(container),
        linkedInputId: container.dataset.equipdPlacesInputId ?? null,
        visible: isVisible(container),
        items: [...container.querySelectorAll('.pac-item')].map((item) => item.textContent?.trim()),
      }))

      const inputRect = input?.getBoundingClientRect()
      const coveringElements = input
        ? [...document.querySelectorAll('body *')]
            .filter((el) => {
              if (el === input || input.contains(el) || el.contains(input)) return false
              const cs = getComputedStyle(el)
              if (cs.pointerEvents === 'none' || cs.visibility === 'hidden') return false
              const rect = el.getBoundingClientRect()
              if (rect.width < 4 || rect.height < 4) return false
              const overlaps =
                rect.left < inputRect.right
                && rect.right > inputRect.left
                && rect.top < inputRect.bottom
                && rect.bottom > inputRect.top
              if (!overlaps) return false
              const z = Number(cs.zIndex) || 0
              return z >= 1000 || cs.position === 'fixed' || cs.position === 'sticky'
            })
            .slice(0, 8)
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className: el.className?.slice?.(0, 120) ?? '',
              zIndex: getComputedStyle(el).zIndex,
              position: getComputedStyle(el).position,
            }))
        : []

      const autocomplete = input?._equipdPlacesAutocomplete ?? null
      const pacContainer = input?._equipdPacContainer ?? null

      return {
        label: stateLabel,
        inputExists: Boolean(input),
        inputDisabled: input?.disabled ?? null,
        inputReadOnly: input?.readOnly ?? null,
        inputValue: input?.value ?? null,
        inputAutocompleteBound: Boolean(autocomplete),
        inputPacLinked: Boolean(pacContainer),
        inputPacConnected: pacContainer?.isConnected ?? null,
        activeElementId: active?.id ?? null,
        activeElementTag: active?.tagName?.toLowerCase() ?? null,
        inputFocused: active === input,
        pacContainerCount: pacContainers.length,
        visiblePacCount: pacDetails.filter((p) => p.visible).length,
        pacWithItems: pacDetails.filter((p) => p.childCount > 0).length,
        pacDetails,
        inputStyle,
        coveringElements,
        googleMapsReady: Boolean(window.google?.maps?.places),
        searchTerm,
      }
    },
    { inputId: LOCATION_INPUT_ID, searchTerm: SEARCH_TERM, stateLabel: label },
  )
}

async function fillMinimumPublishFields(page) {
  await page.locator('#listing-title').fill('Test listing title')
  await page.locator('#listing-description').fill('Test description long enough for validation.')
  await page.locator('#listing-category').selectOption({ index: 1 })
  await page.waitForSelector('#listing-condition', { state: 'visible', timeout: 10000 })
  await page.locator('#listing-condition').selectOption({ index: 1 })
  await page.locator('#listing-price').fill('100')

  await page.locator('input[value="collection"]').check()

  await page.locator('#listing-collection-address').fill('10 Test Street, Leeds')
  await page.locator('#listing-collection-phone').fill('07123456789')

  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles({
    name: 'test-listing.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })
}

loadEnvFile('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const googleKey = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

if (!googleKey) {
  console.error('Missing VITE_GOOGLE_MAPS_API_KEY')
  process.exit(1)
}

const consoleMessages = []
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await createAuthenticatedContext(browser, supabaseUrl, anonKey)
const page = await context.newPage()

page.on('console', (msg) => {
  consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
})

await page.goto(new URL('/listings/new', baseUrl).href, {
  waitUntil: 'networkidle',
  timeout: 60000,
})

await page.waitForSelector(`#${LOCATION_INPUT_ID}`, { timeout: 30000 })
await page.waitForFunction(() => Boolean(window.google?.maps?.places), null, {
  timeout: 30000,
})

const beforeSubmit = await inspectPlacesState(page, 'before-submit')

const locationInput = page.locator(`#${LOCATION_INPUT_ID}`)
await locationInput.click()
await locationInput.fill('')
await locationInput.pressSequentially(SEARCH_TERM, { delay: 80 })
await page.waitForTimeout(1500)

const beforeSubmitTyping = await inspectPlacesState(page, 'before-submit-after-typing')

await fillMinimumPublishFields(page)
  await page.locator('button.listing-form__button--primary[type="submit"]').click()
  await page.waitForTimeout(1500)

  const errorLocator = page.locator('.listing-form__message--error')
  const hasError = await errorLocator.count()
  if (hasError === 0) {
    const bodyText = await page.locator('.listing-form-page').innerText()
    throw new Error(`Expected validation error but none found. Page text:\n${bodyText.slice(0, 800)}`)
  }

const afterValidationError = await inspectPlacesState(page, 'after-validation-error')

const formErrorText = (await errorLocator.first().textContent())?.trim() ?? null

await locationInput.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)

const afterScrollToLocation = await inspectPlacesState(page, 'after-scroll-to-location')

await locationInput.click()
await page.waitForTimeout(1000)

const afterClickOnlyNoTyping = await inspectPlacesState(page, 'after-click-only-no-typing')

await locationInput.fill('')
await locationInput.pressSequentially(SEARCH_TERM, { delay: 80 })
await page.waitForTimeout(2000)

const afterFailedSubmitTyping = await inspectPlacesState(page, 'after-failed-submit-typing')

const report = {
  formErrorText,
  googleKeyConfigured: Boolean(googleKey),
  consoleMessages: consoleMessages.filter((line) =>
    /google|maps|places|pac|autocomplete|error|warn/i.test(line),
  ),
  beforeSubmit,
  beforeSubmitTyping,
  afterValidationError,
  afterScrollToLocation,
  afterClickOnlyNoTyping,
  afterFailedSubmitTyping,
}

console.log(JSON.stringify(report, null, 2))

const beforeWorked =
  beforeSubmitTyping.visiblePacCount > 0 || beforeSubmitTyping.pacWithItems > 0
const clickOnlyBroken =
  afterClickOnlyNoTyping.visiblePacCount === 0 && afterClickOnlyNoTyping.pacWithItems > 0
const afterBroken =
  afterFailedSubmitTyping.visiblePacCount === 0 && afterFailedSubmitTyping.pacWithItems === 0

console.log('\n--- SUMMARY ---')
console.log(`Suggestions visible BEFORE failed submit: ${beforeWorked}`)
console.log(`Location input off-screen after error: ${afterValidationError.inputStyle?.rect?.top < 0}`)
console.log(`PAC has items but hidden after error (click-only prep): ${afterValidationError.pacWithItems > 0 && afterValidationError.visiblePacCount === 0}`)
console.log(`Click-only after scroll (no retype) shows PAC: ${!clickOnlyBroken}`)
console.log(`Suggestions visible AFTER retype: ${!afterBroken}`)
console.log(`Autocomplete still bound after failed submit: ${afterFailedSubmitTyping.inputAutocompleteBound}`)
console.log(`Input disabled after failed submit: ${afterFailedSubmitTyping.inputDisabled}`)
console.log(`Input remounted (autocomplete lost): ${afterValidationError.inputAutocompleteBound && !afterFailedSubmitTyping.inputAutocompleteBound ? 'YES' : 'NO'}`)
console.log(`PAC containers after typing: ${afterFailedSubmitTyping.pacContainerCount}`)
console.log(`PAC with items after typing: ${afterFailedSubmitTyping.pacWithItems}`)
console.log(`Hidden PAC containers: ${afterFailedSubmitTyping.pacDetails.filter((p) => p.hiddenClass).length}`)

await browser.close()

if (beforeWorked && afterBroken) {
  process.exitCode = 2
}
