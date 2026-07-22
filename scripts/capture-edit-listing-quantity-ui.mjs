#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const reportDir = 'reports/inventory-stage1'
const css = await readFile('src/components/ListingForm.css', 'utf8')

await mkdir(reportDir, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })

function quantityCardHtml({ value = '5', minimumNote = '', buttonDisabled = true, focused = false }) {
  const focusAttr = focused ? ' autofocus' : ''
  const disabledAttr = buttonDisabled ? ' disabled' : ''
  return `
    <section class="listing-form__section listing-form__section--quantity">
      <h2 class="listing-form__section-title">Quantity</h2>
      <div class="listing-form__card listing-form__quantity-card">
        <form class="listing-form__quantity-editor">
          <div class="listing-form__quantity-field">
            <label class="listing-form__quantity-label" for="edit-listing-quantity-total">
              Quantity available for this listing
            </label>
            <input
              id="edit-listing-quantity-total"
              class="listing-form__input listing-form__input--boxed listing-form__quantity-input"
              type="number"
              min="2"
              max="999"
              step="1"
              value="${value}"${focusAttr}
            />
            ${
              minimumNote
                ? `<p class="listing-form__hint listing-form__quantity-hint">${minimumNote}</p>`
                : ''
            }
            <button type="button" class="listing-form__button listing-form__button--secondary listing-form__quantity-editor-button"${disabledAttr}>
              Update quantity
            </button>
          </div>
        </form>
      </div>
    </section>
    <section class="listing-form__section">
      <h2 class="listing-form__section-title">Photos</h2>
      <div class="listing-form__card"><p style="margin:0;color:#667;">Photo upload area</p></div>
    </section>
  `
}

function pageHtml(body) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --space-xs: 0.25rem;
        --space-sm: 0.5rem;
        --space-md: 0.75rem;
        --space-lg: 1rem;
        --space-xl: 1.5rem;
        --space-2xl: 2rem;
        --radius: 0.5rem;
        --color-bg: #f4f5f7;
        --color-surface: #fff;
        --color-border: #d8dee6;
        --color-text: #1f2933;
        --color-navy: #0f2137;
        --color-muted: #5c6570;
        --color-orange: #f97316;
        --color-orange-hover: #ea580c;
        --color-danger: #dc2626;
      }
      body { margin: 0; font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); }
      .listing-form-page { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1rem 2rem; }
      .listing-form-page__title { margin: 0 0 1.5rem; font-size: 1.5rem; font-weight: 700; color: var(--color-navy); }
      ${css}
    </style>
  </head>
  <body>
    <div class="listing-form-page">
      <h1 class="listing-form-page__title">Edit listing</h1>
      ${body}
    </div>
  </body>
</html>`
}

async function capture({ name, mobile = false, body, focusInput = false }) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  })
  await page.setContent(pageHtml(body), { waitUntil: 'domcontentloaded' })
  if (focusInput) {
    await page.locator('#edit-listing-quantity-total').focus()
  }
  await page.waitForTimeout(200)
  await page.screenshot({
    path: `${reportDir}/edit-listing-quantity-${name}.png`,
    fullPage: false,
  })
  await page.close()
}

await capture({
  name: 'desktop-reserved',
  body: quantityCardHtml({
    minimumNote:
      'This listing has 2 reserved items, so the quantity cannot be reduced below 2.',
  }),
})

await capture({
  name: 'desktop-clean',
  body: quantityCardHtml({ minimumNote: '' }),
})

await capture({
  name: 'mobile-reserved',
  mobile: true,
  body: quantityCardHtml({
    minimumNote:
      'This listing has 2 reserved items, so the quantity cannot be reduced below 2.',
  }),
})

await capture({
  name: 'desktop-focus',
  body: quantityCardHtml({
    minimumNote:
      'This listing has 2 reserved items, so the quantity cannot be reduced below 2.',
  }),
  focusInput: true,
})

await capture({
  name: 'desktop-changed-enabled',
  body: quantityCardHtml({
    value: '6',
    minimumNote:
      'This listing has 2 reserved items, so the quantity cannot be reduced below 2.',
    buttonDisabled: false,
  }),
})

await browser.close()
console.log('edit listing quantity screenshots saved')
