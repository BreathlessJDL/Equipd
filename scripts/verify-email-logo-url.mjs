#!/usr/bin/env node
/**
 * Verify the production email logo URL returns image/png.
 *
 * Usage:
 *   node scripts/verify-email-logo-url.mjs
 *   node scripts/verify-email-logo-url.mjs https://equipd.co.uk/email/equipd-full-logo.png
 */

import { DEFAULT_EMAIL_LOGO_URL } from '../supabase/functions/_shared/transactionalEmailCore.js'

const url = process.argv[2]?.trim() || DEFAULT_EMAIL_LOGO_URL

async function main() {
  console.log(`Checking ${url}`)

  const response = await fetch(url, { method: 'GET', redirect: 'follow' })
  const contentType = response.headers.get('content-type') ?? ''
  const buffer = await response.arrayBuffer()
  const isPng =
    buffer.byteLength >= 8 &&
    new Uint8Array(buffer)[0] === 0x89 &&
    new Uint8Array(buffer)[1] === 0x50

  console.log(`Status: ${response.status} ${response.statusText}`)
  console.log(`Content-Type: ${contentType}`)
  console.log(`Bytes: ${buffer.byteLength}`)
  console.log(`PNG signature: ${isPng ? 'yes' : 'no'}`)

  if (!response.ok) {
    console.error('FAIL: URL did not return HTTP 2xx')
    process.exit(1)
  }

  if (!contentType.includes('image/png') && !isPng) {
    const preview = new TextDecoder().decode(buffer.slice(0, 120))
    console.error('FAIL: Response is not image/png')
    console.error(`Body preview: ${preview.replace(/\s+/g, ' ')}`)
    console.error(
      'Likely causes: logo not deployed (commit public/email/), or SPA rewrite serving index.html.',
    )
    process.exit(1)
  }

  console.log('OK: Logo URL serves a PNG image')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
