#!/usr/bin/env node
/**
 * Send a test transactional email via SendGrid (master_test template).
 *
 * Usage:
 *   npm run email:test-send
 *   npm run email:test-send -- you@example.com
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { loadEnvFiles } from '../emails/node/loadEnv.mjs'
import { sendTransactionalEmail } from '../emails/node/sendTransactionalEmail.mjs'
import { getPreviewMockData } from '../emails/preview/mockData.js'
import {
  enrichDynamicData,
  isDryRunMode,
  DEFAULT_EMAIL_LOGO_URL,
} from '../supabase/functions/_shared/transactionalEmailCore.js'
import { getDistPaths } from '../emails/renderMasterEmail.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const getEnv = (key) => process.env[key] ?? ''

loadEnvFiles()

const to =
  process.argv[2]?.trim() ||
  process.env.EMAIL_TEST_TO?.trim() ||
  process.env.SENDGRID_TEST_TO?.trim()

if (!to) {
  console.error('Provide a recipient: npm run email:test-send -- you@example.com')
  console.error('Or set EMAIL_TEST_TO in .env.local')
  process.exit(1)
}

const dynamicData = getPreviewMockData('master_test')
const enriched = enrichDynamicData(dynamicData, getEnv)
const dryRun = isDryRunMode(getEnv)

console.log(`Sending master_test email to ${to}${dryRun ? ' (dry-run)' : ''}...`)
console.log(`logo_url in dynamic_template_data: ${enriched.logo_url}`)

const { masterPath } = getDistPaths()
const masterHtml = await readFile(masterPath, 'utf8')
const imgMatch = masterHtml.match(/<img[^>]*src="\{\{logo_url\}\}"[^>]*>/)
if (imgMatch) {
  console.log(`master.html img placeholder: ${imgMatch[0]}`)
}
console.log(`Expected rendered img src: ${enriched.logo_url}`)

if (!dryRun) {
  try {
    const logoResponse = await fetch(enriched.logo_url, { method: 'GET', redirect: 'follow' })
    const contentType = logoResponse.headers.get('content-type') ?? ''
    console.log(
      `Logo URL probe: ${logoResponse.status} ${contentType || '(no content-type)'}`,
    )
    if (!logoResponse.ok || !contentType.includes('image/png')) {
      console.warn(
        'WARNING: logo_url does not return image/png in production yet. Commit public/email/equipd-full-logo.png and deploy before expecting the logo in email clients.',
      )
    }
  } catch (error) {
    console.warn(`WARNING: could not probe logo_url (${error.message})`)
  }
}

const result = await sendTransactionalEmail({
  to,
  templateKey: 'master_test',
  dynamicData,
})

if (!result.ok) {
  console.error('Test send failed:', result.error)
  process.exit(1)
}

if (result.dryRun) {
  console.log('Dry-run complete. Payload logged above.')
  console.log(`Default production logo URL: ${DEFAULT_EMAIL_LOGO_URL}`)
  process.exit(0)
}

console.log('Test email sent successfully.')
if (result.messageId) {
  console.log(`SendGrid message ID: ${result.messageId}`)
}
console.log(
  'In the received email HTML, img src should equal logo_url above. If not, re-paste emails/dist/master.html into SendGrid and activate the new template version.',
)
