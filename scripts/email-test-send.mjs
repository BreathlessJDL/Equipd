#!/usr/bin/env node
/**
 * Send a test transactional email via SendGrid.
 *
 * Usage:
 *   npm run email:test-send -- <recipient_email>
 *   npm run email:test-send -- <template_key> <recipient_email>
 *
 * Examples:
 *   npm run email:test-send -- jlinnell95@gmail.com
 *   npm run email:test-send -- offer_received jlinnell95@gmail.com
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
import {
  getTemplateEnvVarName,
  isEmailTemplateKey,
  listEmailTemplateKeys,
} from '../supabase/functions/_shared/emailTemplateConfig.js'
import { getDistPaths } from '../emails/renderMasterEmail.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const getEnv = (key) => process.env[key] ?? ''

loadEnvFiles()

function defaultRecipient() {
  return process.env.EMAIL_TEST_TO?.trim() || process.env.SENDGRID_TEST_TO?.trim() || ''
}

function parseCliArgs() {
  const arg1 = process.argv[2]?.trim()
  const arg2 = process.argv[3]?.trim()

  if (!arg1) {
    const to = defaultRecipient()
    if (!to) {
      return {
        ok: false,
        error:
          'Provide a recipient: npm run email:test-send -- you@example.com\n' +
          'Or: npm run email:test-send -- offer_received you@example.com\n' +
          'Or set EMAIL_TEST_TO in .env.local',
      }
    }
    if (!EMAIL_PATTERN.test(to)) {
      return { ok: false, error: `Invalid recipient email: ${to}` }
    }
    return { ok: true, templateKey: 'master_test', to }
  }

  if (isEmailTemplateKey(arg1)) {
    const to = arg2 || defaultRecipient()
    if (!to) {
      return {
        ok: false,
        error:
          `Template "${arg1}" requires a recipient email.\n` +
          `Usage: npm run email:test-send -- ${arg1} you@example.com`,
      }
    }
    if (!EMAIL_PATTERN.test(to)) {
      return { ok: false, error: `Invalid recipient email: ${to}` }
    }
    return { ok: true, templateKey: arg1, to }
  }

  if (EMAIL_PATTERN.test(arg1)) {
    return { ok: true, templateKey: 'master_test', to: arg1 }
  }

  return {
    ok: false,
    error:
      `Unknown template key: ${arg1}\n` +
      `Available keys: ${listEmailTemplateKeys().join(', ')}\n` +
      'If you meant to send to an email address, use: npm run email:test-send -- you@example.com',
  }
}

function validateEnvForSend(templateKey) {
  const dryRun = isDryRunMode(getEnv)
  const missing = []

  if (!dryRun) {
    if (!getEnv('SENDGRID_API_KEY')?.trim()) {
      missing.push('SENDGRID_API_KEY')
    }
    if (!getEnv('SENDGRID_FROM_EMAIL')?.trim()) {
      missing.push('SENDGRID_FROM_EMAIL')
    }

    const templateEnvVar = getTemplateEnvVarName(templateKey)
    if (templateEnvVar && !getEnv(templateEnvVar)?.trim()) {
      missing.push(`${templateEnvVar} (SendGrid template ID for "${templateKey}")`)
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        `Missing required environment variable(s):\n` +
        missing.map((name) => `  - ${name}`).join('\n') +
        '\n\nSet them in .env.local or enable dry-run with EMAIL_DRY_RUN=true (or omit SENDGRID_API_KEY).',
    }
  }

  return { ok: true, dryRun }
}

const parsed = parseCliArgs()
if (!parsed.ok) {
  console.error(parsed.error)
  process.exit(1)
}

const { templateKey, to } = parsed

const dynamicData = getPreviewMockData(templateKey, getEnv)
if (!dynamicData) {
  console.error(`No mock data configured for template key: ${templateKey}`)
  console.error(`Available keys: ${listEmailTemplateKeys().join(', ')}`)
  process.exit(1)
}

const envCheck = validateEnvForSend(templateKey)
if (!envCheck.ok) {
  console.error(envCheck.error)
  process.exit(1)
}

const enriched = enrichDynamicData(dynamicData, getEnv)
const dryRun = envCheck.dryRun

const templateEnvVar = getTemplateEnvVarName(templateKey)
const templateId = templateEnvVar ? getEnv(templateEnvVar)?.trim() : ''

console.log(`Template key: ${templateKey}`)
console.log(`Recipient: ${to}`)
if (templateEnvVar) {
  console.log(`SendGrid env var: ${templateEnvVar}${templateId ? `=${templateId}` : ' (not set — dry-run only)'}`)
}
console.log(`Sending ${dryRun ? '(dry-run) ' : ''}...`)
console.log(`logo_url in dynamic_template_data: ${enriched.logo_url}`)

const { masterPath } = getDistPaths()
try {
  const masterHtml = await readFile(masterPath, 'utf8')
  const imgMatch = masterHtml.match(/<img[^>]*src="\{\{logo_url\}\}"[^>]*>/)
  if (imgMatch) {
    console.log(`master.html img placeholder: ${imgMatch[0]}`)
  }
} catch {
  console.warn(`WARNING: ${path.relative(ROOT, masterPath)} not found. Run npm run email:build-master first.`)
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
        'WARNING: logo_url does not return image/png. Deploy public/email/equipd-full-logo.png before expecting the logo in email clients.',
      )
    }
  } catch (error) {
    console.warn(`WARNING: could not probe logo_url (${error.message})`)
  }
}

const result = await sendTransactionalEmail({
  to,
  templateKey,
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
  `In the received email, verify content matches mock data for "${templateKey}". ` +
    'If the layout is wrong, re-paste emails/sendgrid/<key>.html into SendGrid and activate the new version.',
)
